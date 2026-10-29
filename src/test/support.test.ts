import { describe, expect, it } from "vitest";
import { decryptBytes, decryptJson, encryptBytes, encryptJson, exportPublicJwk, newTicketKey, unwrapTicketKey, wrapTicketKey } from "@/lib/support-crypto";
import { attachmentsError, readMessageId, supportStatusLabel, translateSupportError } from "@/lib/support";

const pair = () => crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]) as Promise<CryptoKeyPair>;

describe("chiffrement support", () => {
  it("un autre appareil déballe la clé du ticket et lit le message", async () => {
    const me = await pair(), other = await pair();
    const myPub = await exportPublicJwk(me.publicKey), otherPub = await exportPublicJwk(other.publicKey);
    const key = await newTicketKey();
    const wrapped = await wrapTicketKey(key, me.privateKey, myPub, otherPub);
    const c = await encryptJson(key, { t: "Bonjour" });
    const theirKey = await unwrapTicketKey(wrapped, other.privateKey);
    expect(await decryptJson<{ t: string }>(theirKey, c)).toEqual({ t: "Bonjour" });
  });
  it("mon propre appareil relit sa clé enveloppée pour lui-même", async () => {
    const me = await pair(); const pub = await exportPublicJwk(me.publicKey);
    const key = await newTicketKey();
    const mine = await unwrapTicketKey(await wrapTicketKey(key, me.privateKey, pub, pub), me.privateKey);
    const photo = new Uint8Array([1, 2, 3, 4]).buffer;
    const e = await encryptBytes(key, photo);
    expect(new Uint8Array(await decryptBytes(mine, e.data, e.iv))).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
  it("un appareil sans enveloppe ne peut pas déchiffrer", async () => {
    const me = await pair(), other = await pair(), intruder = await pair();
    const wrapped = await wrapTicketKey(await newTicketKey(), me.privateKey, await exportPublicJwk(me.publicKey), await exportPublicJwk(other.publicKey));
    await expect(unwrapTicketKey(wrapped, intruder.privateKey)).rejects.toBeTruthy();
  });
});

describe("règles support", () => {
  it("limite à 6 photos de 10 Mo", () => {
    expect(attachmentsError(Array(7).fill({ type: "image/png", size: 1 }))).toBe("6 photos maximum");
    expect(attachmentsError([{ type: "image/png", size: 10 * 1024 * 1024 + 1 }])).toBe("10 Mo maximum par photo");
    expect(attachmentsError([{ type: "image/png", size: 10 * 1024 * 1024 }])).toBeNull();
  });
  it("affiche Lu si staffReadAt ≥ dernier message envoyé", () => {
    const msgs = [{ id: "a", from: "customer", createdAt: "2026-10-29T10:00:00Z", statusChange: null }];
    expect(readMessageId(msgs, "2026-10-29T10:00:00Z")).toBe("a");
    expect(readMessageId(msgs, "2026-10-29T09:59:00Z")).toBeNull();
  });
  it("traduit statuts et erreurs", () => {
    expect(supportStatusLabel("resolved")).toBe("Résolu");
    expect(translateSupportError(403, "support_subscribers_only")).toBe("Le support est réservé aux abonnés");
    expect(translateSupportError(404, "not_found")).toBe("Demande introuvable");
    expect(translateSupportError(401, "customer_session_expired")).toBe("Session expirée, reconnectez-vous");
  });
});
