import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { hypertv, HypertvError } from "./hypertvClient.server";
import { clearSession, readSession } from "./account.server";
import { SESSION_ERRORS } from "./account";
import { cipherSchema, normalizeDevices, normalizeTicketDetail, normalizeTicketSummary, SUPPORT_CATEGORIES, SUPPORT_ERRORS, translateSupportError } from "./support";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rec = (v: unknown): any => (v && typeof v === "object" ? v : {});
const id = z.string().min(1).max(150);
const b64 = z.string().min(1).max(20_000);

async function supportCall<T>(run: (session: string) => Promise<T>): Promise<T> {
  setResponseHeader("Cache-Control", "no-store");
  const session = readSession();
  if (!session) throw new Error(SUPPORT_ERRORS.session);
  try {
    return await run(session);
  } catch (e) {
    if (e instanceof HypertvError) {
      if (e.status === 401 || SESSION_ERRORS.includes(e.code)) clearSession();
      throw new Error(translateSupportError(e.status, e.code));
    }
    throw new Error(e instanceof Error ? e.message : "Support momentanément indisponible.");
  }
}

export const getSupportIdentity = createServerFn({ method: "GET" }).handler(() =>
  supportCall(async (session) => {
    const raw = rec(await hypertv.getAccount(session));
    const a = rec(raw.account ?? raw.customer ?? raw);
    const customerId = String(a.id ?? a.customerId ?? a.username ?? "client");
    const username = typeof a.username === "string" ? a.username : null;
    return { customerId, username };
  }),
);

export const registerSupportDevice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ publicKey: z.string().min(20).max(1000), label: z.string().min(1).max(60) }).parse(d))
  .handler(({ data }) => supportCall(async (session) => {
    const r = await hypertv.supportRegisterDevice(session, data);
    const deviceId = r.deviceId ?? r.id;
    if (!deviceId) throw new Error("Appareil non enregistré.");
    return { deviceId: String(deviceId) };
  }));

export const listSupportTickets = createServerFn({ method: "GET" }).handler(() =>
  supportCall(async (session) => {
    const r = rec(await hypertv.supportTickets(session));
    return { canCreate: r.canCreate !== false, tickets: (Array.isArray(r.tickets) ? (r.tickets as unknown[]) : []).map(normalizeTicketSummary) };
  }),
);

export const createSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ category: z.enum(SUPPORT_CATEGORIES.map((c) => c.value) as [string, ...string[]]), subject: cipherSchema }).parse(d))
  .handler(({ data }) => supportCall(async (session) => {
    const r = rec(await hypertv.supportCreate(session, data));
    const t = rec(r.ticket ?? r);
    return { id: String(t.id ?? r.id), devices: normalizeDevices(r.devices) };
  }));

export const addSupportKeys = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id, keys: z.array(z.object({ deviceId: id, wrappedKey: b64, iv: b64, wrapperPub: z.string().min(20).max(1000) })).min(1).max(50) }).parse(d))
  .handler(({ data }) => supportCall(async (session) => { await hypertv.supportKeys(session, data.id, data.keys); return { ok: true }; }));

export const getSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id, deviceId: id, after: z.string().max(60).optional() }).parse(d))
  .handler(({ data }) => supportCall(async (session) => normalizeTicketDetail(await hypertv.supportTicket(session, data.id, data.deviceId, data.after))));

export const sendSupportMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cipherSchema.extend({ id }).parse(d))
  .handler(({ data }) => supportCall(async (session) => { await hypertv.supportMessage(session, data.id, { ct: data.ct, iv: data.iv }); return { ok: true }; }));

export const requestSupportUploads = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id, files: z.array(z.object({ mime: z.string().regex(/^image\/[\w.+-]+$/), size: z.number().int().positive().max(10 * 1024 * 1024 + 64) })).min(1).max(6) }).parse(d))
  .handler(({ data }) => supportCall(async (session) => {
    const r = rec(await hypertv.supportUploads(session, data.id, data.files));
    return (Array.isArray(r.uploads) ? (r.uploads as unknown[]) : []).map(rec).map((u: any): { path: string; uploadUrl: string } => ({ path: String(u.path), uploadUrl: String(u.uploadUrl) }));
  }));

export const getSupportAttachment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id, path: z.string().min(1).max(500) }).parse(d))
  .handler(({ data }) => supportCall(async (session) => {
    const r = rec(await hypertv.supportAttachment(session, data.id, data.path));
    const url = r.url ?? r.signedUrl;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new Error("Photo indisponible.");
    return { url };
  }));

export const setSupportStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cipherSchema.extend({ id, expected: z.string().min(1).max(40), status: z.enum(["resolved", "open"]) }).parse(d))
  .handler(({ data }) => supportCall(async (session) => {
    await hypertv.supportStatus(session, data.id, { expected: data.expected, status: data.status, ct: data.ct, iv: data.iv });
    return { ok: true };
  }));

export const markSupportRead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(({ data }) => supportCall(async (session) => { await hypertv.supportRead(session, data.id); return { ok: true }; }));
