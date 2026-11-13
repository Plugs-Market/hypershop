import { describe, expect, it, vi, beforeEach } from "vitest";
import { catalogHypervodPlans, type HypervodPlan } from "@/lib/shop-offers";
import { orderInputSchema, shouldPollOrder } from "@/lib/shop-order";
import { canReadDelivery, privateDelivery, lineExpiry } from "@/lib/playlist-security";
import { normalizeInvoice } from "@/lib/invoices";
import { translateHypertvError } from "@/lib/hypertv-shared";
const mocks = vi.hoisted(() => ({ owns: vi.fn(), order: vi.fn(), header: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ handler: (f: unknown) => f, inputValidator: () => ({ handler: (f: unknown) => f }) }), createServerOnlyFn: (f: unknown) => f }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: mocks.header, getRequestHeader: vi.fn() }));
vi.mock("@/lib/order-access.server", () => ({ ownerHash: vi.fn(), ownsOrder: mocks.owns, hashValue: vi.fn() }));
vi.mock("@/lib/hypertvClient.server", () => ({ HypertvError: class extends Error {}, hypertv: { getOrder: mocks.order } }));
import { getDelivery, getOrder } from "@/lib/shop.functions";
const callDelivery = getDelivery as unknown as (args: { data: { id: string } }) => Promise<{ delivery: unknown }>;
const callOrder = getOrder as unknown as (args: { data: { id: string } }) => Promise<unknown>;
const base = { mac: "00:1A:79:AB:CD:EF", idempotencyKey: "12345678-1234-4123-8123-123456789abc" };
const delivery = { m3uUrl: "https://vod.example/get.php?password=private-pass", xtream: { serverUrl: "https://vod.example", username: "private-user", password: "private-pass" }, expiresAt: "2027-11-13T00:00:00Z" };
beforeEach(() => vi.clearAllMocks());
describe("HYPER VOD", () => {
  it("normalise le catalogue Xtream et conserve valeurs, images et labels fournisseur", () => {
    const plan: HypervodPlan = { id: "vod", type: "hypervod", delivery: "automatic", title: "Films", description: "Séries", cover_url: "https://example.com/cover.jpg", price_eur: 14.5, currency: "EUR", line: { type: "xtream", labels: ["VOD", "HD"], isDemo: false, months: 3, durationDays: 90, screens: 2 }, includesHypertvSubscription: { name: "PRO", durationDays: 365, maxDevices: 1 } };
    expect(catalogHypervodPlans({ resellerOffers: [], subscriptionPlans: [], hypervodPlans: [plan] })).toEqual([{ id: "vod", name: "Films", description: "Séries", cover_url: plan.cover_url, price_cents: 1450, line: plan.line, includesHypertvSubscription: plan.includesHypertvSubscription }]);
  });
  it("permet une démo gratuite sans paiement et avec email facultatif", () => {
    expect(orderInputSchema.parse({ ...base, vodPlanId: "demo" })).toEqual({ ...base, vodPlanId: "demo" });
    expect(orderInputSchema.parse({ ...base, vodPlanId: "demo", email: "client@example.com" })).toHaveProperty("email", "client@example.com");
  });
  it.each(["planId", "trexPlanId", "lionPlanId"])("refuse vodPlanId combiné à %s", field => {
    expect(orderInputSchema.safeParse({ ...base, vodPlanId: "vod", [field]: "other" }).success).toBe(false);
  });
  it("refuse le prix navigateur", () => expect(orderInputSchema.safeParse({ ...base, vodPlanId: "vod", price_eur: 0 }).success).toBe(false));
  it("protège les accès y compris gratuits, et refuse les états non terminés", () => {
    for (const state of ["activated", "completed", "finished", "delivered"]) {
      expect(canReadDelivery({ type: "hypervod", state }, true)).toBe(true);
      expect(canReadDelivery({ type: "hypervod", state }, false)).toBe(false);
    }
    expect(canReadDelivery({ type: "hypervod", state: "paid_activation_failed" }, true)).toBe(false);
  });
  it("ne renvoie aucun accès sans preuve propriétaire côté serveur", async () => {
    mocks.owns.mockResolvedValue(false);
    expect((await callDelivery({ data: { id: base.idempotencyKey } })).delivery).toBeNull();
    expect(mocks.order).not.toHaveBeenCalled();
  });
  it("lit les accès terminés uniquement après vérification serveur, sans cache", async () => {
    mocks.owns.mockResolvedValue(true);
    mocks.order.mockResolvedValue({ type: "hypervod", state: "completed", delivery: { ...delivery, extraSecret: "hidden" } });
    expect((await callDelivery({ data: { id: base.idempotencyKey } })).delivery).toEqual(delivery);
    expect(mocks.header).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("ne sérialise ni accès ni champs inconnus dans le suivi ou l’historique", async () => {
    const raw = { id: base.idempotencyKey, type: "hypervod", state: "completed", delivery, password: "private-pass", activationError: "internal-credit-error" };
    mocks.owns.mockResolvedValue(true); mocks.order.mockResolvedValue(raw);
    for (const result of [await callOrder({ data: { id: raw.id } }), normalizeInvoice(raw)]) {
      expect(JSON.stringify(result)).not.toContain("private-pass");
      expect(JSON.stringify(result)).not.toContain("private-user");
      expect(JSON.stringify(result)).not.toContain("internal-credit-error");
    }
    expect(normalizeInvoice(raw).type).toBe("hypervod");
  });
  it("ne conserve que les accès spécifiés et utilise seulement leur expiration", () => {
    expect(privateDelivery({ ...delivery, secret: "discard" })).toEqual(delivery);
    expect(lineExpiry({ type: "hypervod", delivery, subscriptionExpiresAt: "2030-01-01" })).toBe(delivery.expiresAt);
    expect(lineExpiry({ type: "hypervod", subscriptionExpiresAt: "2030-01-01" })).toBeNull();
  });
  it("continue le suivi en cas d’échec mais arrête une livraison terminée", () => {
    expect(shouldPollOrder({ type: "hypervod", state: "paid_activation_failed", activationError: "credits" })).toBe(true);
    expect(shouldPollOrder({ type: "hypervod", state: "completed" })).toBe(false);
  });
  it("reconnaît les erreurs métier même avec HTTP 403", () => {
    expect(translateHypertvError(403, "customer_locked_to_other_reseller")).toBe("Ce compte est géré par un autre revendeur");
    expect(translateHypertvError(409, "vod_demo_already_used")).not.toBe(translateHypertvError(409, "unknown"));
  });
});
