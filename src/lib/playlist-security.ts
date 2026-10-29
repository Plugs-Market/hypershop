export type Delivery = { m3uUrl: string; xtream: { serverUrl: string; username: string; password: string }; expiresAt: string | null };
export function canReadDelivery(order: { type?: string; state: string }, authorized: boolean) {
  return authorized && order.type === "trex" && order.state === "activated";
}
export function lineExpiry(order: { type?: string; subscriptionExpiresAt?: string | null; delivery?: Delivery | null }) {
  return order.type === "trex" ? order.delivery?.expiresAt ?? null : order.subscriptionExpiresAt ?? null;
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
  return a !== 0 && a !== 10 && a !== 127 && a < 224 && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0)) && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && (b === 18 || b === 19 || b === 51)) && !(a === 203 && b === 0);
}
export const MAX_PLAYLIST_BYTES = 20 * 1024 * 1024;