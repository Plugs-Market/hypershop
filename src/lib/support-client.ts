// Logique navigateur du support : appareil, clés de ticket, flux temps réel.
import { useEffect, useRef, useState } from "react";
import { getSupportIdentity, getSupportTicket, registerSupportDevice, addSupportKeys } from "./support.functions";
import { ensureDevice, unwrapTicketKey, wrapTicketKey, type DeviceRecord } from "./support-crypto";
import type { SupportDevice } from "./support";

export type SupportContext = { customerId: string; username: string | null; device: DeviceRecord };

export function useSupportContext() {
  const [ctx, setCtx] = useState<SupportContext | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { customerId, username } = await getSupportIdentity();
      const label = `Boutique · ${navigator.platform || "navigateur"}`.slice(0, 60);
      const device = await ensureDevice(customerId, async (publicKey) => (await registerSupportDevice({ data: { publicKey, label } })).deviceId);
      if (alive) setCtx({ customerId, username, device });
    })().catch((e) => alive && setError(e instanceof Error ? e : new Error("Support indisponible.")));
    return () => { alive = false; };
  }, []);
  return { ctx, error };
}

const keyCache = new Map<string, CryptoKey>();
const wrappedFor = new Map<string, Set<string>>();

// Enveloppe la clé pour chaque appareil qui ne l'a pas encore.
export async function shareTicketKey(ticketId: string, key: CryptoKey, devices: SupportDevice[], device: DeviceRecord, includeAll = false) {
  const done = wrappedFor.get(ticketId) ?? new Set<string>();
  wrappedFor.set(ticketId, done);
  const list = devices.filter((d) => !done.has(d.id) && (includeAll || (d.id !== device.deviceId && d.hasKey !== true)));
  if (includeAll && !list.some((d) => d.id === device.deviceId) && !done.has(device.deviceId))
    list.push({ id: device.deviceId, publicKey: device.publicJwk, owner: "customer", hasKey: false });
  if (!list.length) return;
  const keys = await Promise.all(list.map(async (d) => ({ deviceId: d.id, ...(await wrapTicketKey(key, device.privateKey, device.publicJwk, d.publicKey)) })));
  await addSupportKeys({ data: { id: ticketId, keys } });
  list.forEach((d) => done.add(d.id));
}
export function rememberTicketKey(id: string, key: CryptoKey) { keyCache.set(id, key); }

// Lit un ticket et renvoie sa clé déchiffrée (null si cet appareil n'y a pas accès).
export async function loadTicket(id: string, device: DeviceRecord, after?: string) {
  const detail = await getSupportTicket({ data: { id, deviceId: device.deviceId, ...(after ? { after } : {}) } });
  let key = keyCache.get(id) ?? null;
  if (!key && detail.key) {
    try { key = await unwrapTicketKey(detail.key, device.privateKey); keyCache.set(id, key); } catch { key = null; }
  }
  if (key && detail.devices.length) await shareTicketKey(id, key, detail.devices, device).catch(() => null);
  return { detail, key };
}

// SSE relayé par la boutique ; repli sur un sondage toutes les 3 s.
export function useSupportLive(onEvent: () => void, enabled = true) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null, poll: ReturnType<typeof setInterval> | null = null, retry: ReturnType<typeof setTimeout> | null = null;
    const fire = () => cb.current();
    const open = () => {
      if (poll) { clearInterval(poll); poll = null; }
      es = new EventSource("/api/support-stream");
      ["message", "status", "read"].forEach((t) => es!.addEventListener(t, fire));
      es.onerror = () => {
        es?.close(); es = null;
        if (!poll) poll = setInterval(fire, 3000);
        retry = setTimeout(open, 60_000);
      };
    };
    open();
    return () => { es?.close(); if (poll) clearInterval(poll); if (retry) clearTimeout(retry); };
  }, [enabled]);
}
