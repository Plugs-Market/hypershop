import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { hypertv, HypertvError } from "./hypertvClient.server";
import { clearMfa, clearSession, readMfa, readSession, writeMfa, writeSession } from "./account.server";
import { ACCESS_KEY_REGEX, SESSION_ERRORS, normalizeAccount, translateAccountError, usernameSchema } from "./account";

function fail(e: unknown): never {
  const code = e instanceof HypertvError ? e.code : undefined;
  if (code && SESSION_ERRORS.includes(code)) clearSession();
  throw new Error(translateAccountError(code));
}

export const loginWithKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ accessKey: z.string().regex(ACCESS_KEY_REGEX) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const r = await hypertv.login(data.accessKey);
      if (r.mfaRequired && r.mfaToken) {
        writeMfa(r.mfaToken);
        return { mfaRequired: true };
      }
      if (!r.session) throw new HypertvError(500, "unknown", "");
      writeSession(r.session);
      return { mfaRequired: false };
    } catch (e) {
      fail(e);
    }
  });

export const loginWithMfa = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data }) => {
    const token = readMfa();
    if (!token) throw new Error(translateAccountError("mfa_token_invalid"));
    try {
      const r = await hypertv.loginMfa(token, data.code);
      if (!r.session) throw new HypertvError(500, "unknown", "");
      clearMfa();
      writeSession(r.session);
      return { ok: true };
    } catch (e) {
      if (e instanceof HypertvError && e.code === "mfa_token_invalid") clearMfa();
      fail(e);
    }
  });

// null = non connecté (ou session expirée : cookie supprimé).
export const getMyAccount = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  const session = readSession();
  if (!session) return null;
  try {
    return normalizeAccount(await hypertv.getAccount(session));
  } catch (e) {
    if (e instanceof HypertvError && SESSION_ERRORS.includes(e.code)) {
      clearSession();
      return null;
    }
    throw new Error(translateAccountError(e instanceof HypertvError ? e.code : undefined));
  }
});

// État léger pour l'en-tête et le checkout : jamais d'erreur.
export const getAccountStatus = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  if (!readSession()) return { loggedIn: false, mac: null as string | null };
  try {
    const a = await getMyAccount();
    return { loggedIn: !!a, mac: a?.mac ?? null };
  } catch {
    return { loggedIn: true, mac: null as string | null };
  }
});

export const updateUsername = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ username: usernameSchema }).parse(d))
  .handler(async ({ data }) => {
    const session = readSession();
    if (!session) throw new Error(translateAccountError("customer_unauthorized"));
    try {
      await hypertv.updateAccount(session, data.username);
      return { ok: true };
    } catch (e) {
      fail(e);
    }
  });

export const logoutCustomer = createServerFn({ method: "POST" }).handler(async () => {
  const session = readSession();
  if (session) await hypertv.logout(session).catch(() => null);
  clearSession();
  return { ok: true };
});

export const accountStatusQuery = queryOptions({
  queryKey: ["account-status"],
  queryFn: () => getAccountStatus(),
  staleTime: 60_000,
});
