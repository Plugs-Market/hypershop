import { describe, expect, it } from "vitest";
import { canReadDelivery, lineExpiry, supplierUrl, publicAddress, MAX_PLAYLIST_BYTES } from "@/lib/playlist-security";

describe("livraison IPTV privée", () => {
  it("refuse un accès non autorisé même pour une commande activée", () => expect(canReadDelivery({ type: "trex", state: "activated" }, false)).toBe(false));
  it("autorise une commande gratuite activée avec preuve propriétaire", () => expect(canReadDelivery({ type: "trex", state: "activated", priceEur: 0 } as { type: string; state: string }, true)).toBe(true));
  it("refuse la lecture en attente ou pour un abonnement sans ligne", () => {
    expect(canReadDelivery({ type: "trex", state: "pending" }, true)).toBe(false);
    expect(canReadDelivery({ type: "subscription", state: "activated" }, true)).toBe(false);
  });
  it("utilise exclusivement la date de livraison pour TREX", () => {
    const delivery = { m3uUrl: "https://line.hypertv.info/get.php", xtream: { serverUrl: "https://line.hypertv.info", username: "test", password: "test" }, expiresAt: "2026-10-30" };
    expect(lineExpiry({ type: "trex", subscriptionExpiresAt: "2030-10-24", delivery })).toBe("2026-10-30");
    expect(lineExpiry({ type: "trex", subscriptionExpiresAt: "2030-10-24", delivery: { ...delivery, expiresAt: null } })).toBeNull();
  });
  it("ne fabrique aucune date TREX si delivery manque", () => expect(lineExpiry({ type: "trex", subscriptionExpiresAt: "2030-10-24" })).toBeNull());
  it("refuse les domaines arbitraires et les redirections privées", () => {
    expect(supplierUrl("https://line.hypertv.info/get.php").hostname).toBe("line.hypertv.info");
    for (const url of ["http://localhost/a", "http://127.0.0.1/a", "http://169.254.169.254/a", "https://line.hypertv.info.evil.com/a", "https://example.com/a", "file:///a", "https://user:password@line.hypertv.info/a"]) expect(() => supplierUrl(url)).toThrow();
  });
  it("refuse les adresses privées et réservées", () => {
    for (const ip of ["127.0.0.1", "10.1.1.1", "169.254.1.1", "172.16.0.1", "192.168.1.1", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(publicAddress(ip)).toBe(false);
    expect(publicAddress("1.1.1.1")).toBe(true);
  });
  it("limite le fichier à 20 Mio", () => expect(MAX_PLAYLIST_BYTES).toBe(20971520));
});