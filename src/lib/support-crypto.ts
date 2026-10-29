// Chiffrement du support — navigateur uniquement (WebCrypto). Jamais importé côté serveur.
// ECDH P-256 → HKDF-SHA256 → AES-256-GCM pour envelopper la clé de ticket ; AES-256-GCM pour le contenu.
import type { Cipher, WrappedKey } from "./support";

const enc = new TextEncoder();
const dec = new TextDecoder();
// Paramètres HKDF (sel et info vides) — à aligner si HyperTV précise un format.
const HKDF_SALT = new Uint8Array(0);
const HKDF_INFO = new Uint8Array(0);
const subtle = () => globalThis.crypto.subtle;
const buf = (u: Uint8Array) => u as unknown as BufferSource;

export function toB64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const randomIv = () => globalThis.crypto.getRandomValues(new Uint8Array(12));

export async function generateDeviceKeys(): Promise<CryptoKeyPair> {
  // Clé privée non exportable.
  return subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]) as Promise<CryptoKeyPair>;
}
export async function exportPublicJwk(pub: CryptoKey): Promise<string> {
  const j = await subtle().exportKey("jwk", pub);
  return JSON.stringify({ kty: j.kty, crv: j.crv, x: j.x, y: j.y });
}
async function importPublic(jwk: string): Promise<CryptoKey> {
  const j = JSON.parse(jwk);
  return subtle().importKey("jwk", { kty: j.kty, crv: j.crv, x: j.x, y: j.y, ext: true }, { name: "ECDH", namedCurve: "P-256" }, false, []);
}
async function wrappingKey(priv: CryptoKey, otherPub: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const bits = await subtle().deriveBits({ name: "ECDH", public: await importPublic(otherPub) }, priv, 256);
  const hk = await subtle().importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "HKDF", hash: "SHA-256", salt: buf(HKDF_SALT), info: buf(HKDF_INFO) }, hk, { name: "AES-GCM", length: 256 }, false, usage);
}

export async function newTicketKey(): Promise<CryptoKey> {
  const raw = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return subtle().importKey("raw", buf(raw), "AES-GCM", true, ["encrypt", "decrypt"]);
}
export async function wrapTicketKey(ticketKey: CryptoKey, myPriv: CryptoKey, myPubJwk: string, devicePubJwk: string): Promise<WrappedKey> {
  const raw = await subtle().exportKey("raw", ticketKey);
  const iv = randomIv();
  const wk = await wrappingKey(myPriv, devicePubJwk, ["encrypt"]);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv: buf(iv) }, wk, raw);
  return { wrappedKey: toB64(ct), iv: toB64(iv), wrapperPub: myPubJwk };
}
export async function unwrapTicketKey(w: WrappedKey, myPriv: CryptoKey): Promise<CryptoKey> {
  const wk = await wrappingKey(myPriv, w.wrapperPub, ["decrypt"]);
  const raw = await subtle().decrypt({ name: "AES-GCM", iv: buf(fromB64(w.iv)) }, wk, buf(fromB64(w.wrappedKey)));
  return subtle().importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<Cipher> {
  const iv = randomIv();
  const ct = await subtle().encrypt({ name: "AES-GCM", iv: buf(iv) }, key, enc.encode(JSON.stringify(value)));
  return { ct: toB64(ct), iv: toB64(iv) };
}
export async function decryptJson<T>(key: CryptoKey, c: Cipher): Promise<T> {
  const pt = await subtle().decrypt({ name: "AES-GCM", iv: buf(fromB64(c.iv)) }, key, buf(fromB64(c.ct)));
  return JSON.parse(dec.decode(pt)) as T;
}
export async function encryptBytes(key: CryptoKey, data: ArrayBuffer): Promise<{ data: ArrayBuffer; iv: string }> {
  const iv = randomIv();
  return { data: await subtle().encrypt({ name: "AES-GCM", iv: buf(iv) }, key, data), iv: toB64(iv) };
}
export async function decryptBytes(key: CryptoKey, data: ArrayBuffer, iv: string): Promise<ArrayBuffer> {
  return subtle().decrypt({ name: "AES-GCM", iv: buf(fromB64(iv)) }, key, data);
}

// --- Stockage IndexedDB de l'appareil (clé par client) ---
export type DeviceRecord = { deviceId: string; privateKey: CryptoKey; publicJwk: string };
const DB = "hypertv-support";
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("devices");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const req = fn(d.transaction("devices", mode).objectStore("devices"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => d.close());
}
export async function ensureDevice(customerId: string, register: (publicKey: string) => Promise<string>): Promise<DeviceRecord> {
  const existing = await tx<DeviceRecord | undefined>("readonly", (s) => s.get(customerId));
  if (existing?.deviceId) return existing;
  const pair = await generateDeviceKeys();
  const publicJwk = await exportPublicJwk(pair.publicKey);
  const deviceId = await register(publicJwk);
  const rec: DeviceRecord = { deviceId, privateKey: pair.privateKey, publicJwk };
  await tx("readwrite", (s) => s.put(rec, customerId));
  return rec;
}
export async function clearSupportDevices(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(DB);
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });
}
