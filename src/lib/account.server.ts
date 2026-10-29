import { deleteCookie, getCookie, getRequestUrl, setCookie } from "@tanstack/react-start/server";
import { createServerOnlyFn } from "@tanstack/react-start";

export const SESSION_COOKIE = "htv_customer";
export const MFA_COOKIE = "htv_mfa";

const opts = (maxAge: number) => ({
  httpOnly: true,
  secure: new URL(getRequestUrl()).protocol === "https:",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export const readSession = createServerOnlyFn(() => getCookie(SESSION_COOKIE) || null);
export const writeSession = createServerOnlyFn((s: string) => setCookie(SESSION_COOKIE, s, opts(60 * 60 * 24 * 7)));
export const clearSession = createServerOnlyFn(() => deleteCookie(SESSION_COOKIE, { path: "/" }));
export const readMfa = createServerOnlyFn(() => getCookie(MFA_COOKIE) || null);
export const writeMfa = createServerOnlyFn((t: string) => setCookie(MFA_COOKIE, t, opts(300)));
export const clearMfa = createServerOnlyFn(() => deleteCookie(MFA_COOKIE, { path: "/" }));
