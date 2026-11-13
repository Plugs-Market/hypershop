export type Delivery = { m3uUrl: string; xtream: { serverUrl: string; username: string; password: string }; expiresAt: string | null };
export function canReadDelivery(order: { type?: string; state: string }, authorized: boolean) {
  return authorized && (order.type === "trex" && order.state === "activated" || order.type === "hypervod" && ["activated", "completed", "finished", "delivered"].includes(order.state));
}
export function lineExpiry(order: { type?: string; subscriptionExpiresAt?: string | null; delivery?: Delivery | null }) {
  return (order.type === "trex" || order.type === "hypervod") ? order.delivery?.expiresAt ?? null : order.subscriptionExpiresAt ?? null;
}
export function supplierUrl(value: string): URL {
  const url = new URL(value);
  // Exact supplier domain observed in the API, never a browser-provided destination.
  if (url.hostname !== "line.hypertv.info" || !["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("Fournisseur non autorisé.");
  return url;
}
export function publicAddress(ip: string): boolean {
  if (ip.includes(":")) return /^2[0-9a-f]{3}:/i.test(ip) && !ip.toLowerCase().startsWith("2001:db8:");
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [a, b] = p;
  if (a === undefined || b === undefined) return false;
  return a !== 0 && a !== 10 && a !== 127 && a < 224 && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0)) && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && (b === 18 || b === 19 || b === 51)) && !(a === 203 && b === 0);
}
export const MAX_PLAYLIST_BYTES = 20 * 1024 * 1024;
// Project only access fields; never relay arbitrary provider payloads.
export function privateDelivery(value: unknown): Delivery | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  if (!d.xtream || typeof d.xtream !== "object") return null;
  const x = d.xtream as Record<string, unknown>;
  if (typeof d.m3uUrl !== "string" || typeof x.serverUrl !== "string" || typeof x.username !== "string" || typeof x.password !== "string") return null;
  return { m3uUrl: d.m3uUrl, xtream: { serverUrl: x.serverUrl, username: x.username, password: x.password }, expiresAt: typeof d.expiresAt === "string" ? d.expiresAt : null };
}
