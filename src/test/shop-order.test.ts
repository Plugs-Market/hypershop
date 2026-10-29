import { describe, expect, it } from "vitest";
import { activationNotice, orderInputSchema, resolveOrderAttempt, shouldPollOrder, trexTimeline } from "@/lib/shop-order";

const common = { mac: "00:1A:79:AB:CD:EF", method: "btc", idempotencyKey: "12345678-1234-4123-8123-123456789abc" };
describe("commande TREX", () => {
  it("envoie trexPlanId à la place de planId", () => {
    const data = orderInputSchema.parse({ ...common, trexPlanId: "trex-12" });
    expect(data).toEqual({ ...common, trexPlanId: "trex-12" });
    expect("planId" in data).toBe(false);
  });
  it("préserve les commandes HyperTV", () => expect(orderInputSchema.parse({ ...common, planId: "pro" })).toEqual({ ...common, planId: "pro" }));
  it("refuse deux identifiants ou aucun", () => {
    expect(orderInputSchema.safeParse({ ...common, planId: "pro", trexPlanId: "trex-12" }).success).toBe(false);
    expect(orderInputSchema.safeParse(common).success).toBe(false);
  });
  it("refuse un prix fourni par le navigateur", () => expect(orderInputSchema.safeParse({ ...common, trexPlanId: "trex-12", price_eur: 1 }).success).toBe(false));
  it("réutilise la clé après un nouvel essai réseau inchangé", () => {
    const first = resolveOrderAttempt(null, "trex-12:mac:btc", () => "first");
    expect(resolveOrderAttempt(first, "trex-12:mac:btc", () => "second").key).toBe("first");
  });
  it("renouvelle la clé si la tentative change", () => {
    expect(resolveOrderAttempt({ signature: "trex-12:mac:btc", key: "first" }, "trex-12:mac:stripe", () => "second").key).toBe("second");
  });
});
describe("suivi TREX", () => {
  it("continue les interrogations après un échec d'activation payé", () => expect(shouldPollOrder({ state: "paid_activation_failed", type: "trex" })).toBe(true));
  it("continue avec une erreur de crédits ou TREX", () => {
    for (const activationError of ["Crédits HyperTV insuffisants.", "trex_unavailable", "trex_line_state_unknown_contact_support"]) {
      expect(shouldPollOrder({ state: "processing", activationError })).toBe(true);
      expect(activationNotice({ state: "processing", activationError })).not.toBeNull();
    }
  });
  it("arrête après activation, expiration ou annulation", () => {
    for (const state of ["activated", "expired", "cancelled"]) expect(shouldPollOrder({ state })).toBe(false);
  });
  it("suit les étapes de la ligne et de la playlist sans prolongation non incluse", () => {
    expect(trexTimeline({ state: "paid", steps: { trexLine: true, playlist: false, subscription: null } }).map((step) => step.done)).toEqual([true, true, false]);
  });
  it("ajoute la prolongation uniquement si incluse", () => {
    const order = { state: "paid", steps: { trexLine: true, playlist: true, subscription: null }, includesHypertvSubscription: { name: "PRO", durationDays: 365, maxDevices: 2 } } as const;
    expect(trexTimeline(order).map((step) => step.done)).toEqual([true, true, true, false]);
    expect(trexTimeline({ ...order, state: "activated" }).map((step) => step.done)).toEqual([true, true, true, true]);
  });
});
describe("commande sans email ni paiement", () => {
  it("accepte une formule gratuite sans mode de paiement ni email", () => {
    expect(orderInputSchema.safeParse({ mac: "00:1A:79:AB:CD:EF", planId: "p", idempotencyKey: "12345678-1234-4123-8123-123456789abc" }).success).toBe(true);
  });
  it("refuse un champ email", () => {
    expect(orderInputSchema.safeParse({ mac: "00:1A:79:AB:CD:EF", planId: "p", email: "a@b.fr", idempotencyKey: "12345678-1234-4123-8123-123456789abc" }).success).toBe(false);
  });
});
