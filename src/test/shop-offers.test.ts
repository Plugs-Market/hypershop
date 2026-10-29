import { describe, expect, it } from "vitest";
import { catalogPlans, enabledSubscriptionPlans, planPriceCents, type SubscriptionPlan } from "@/lib/shop-offers";

const vip: SubscriptionPlan = {
  id: "vip", name: "VIP", description: "Texte personnalisé",
  cover_url: "https://example.com/vip.jpg", duration_days: 30,
  max_devices: 2, reseller_credits: 1, price_eur: 9.90,
  currency: "EUR", is_enabled: true,
};

describe("nouveau schéma des offres HyperTV", () => {
  it("convertit le prix VIP de 9,90 EUR en 990 centimes", () => {
    expect(planPriceCents(vip)).toBe(990);
  });
  it("conserve les données de la formule activée et non les packs revendeur", () => {
    expect(catalogPlans({ resellerOffers: [{ id: "pack", title: "Pack crédits" }], subscriptionPlans: [vip] })).toEqual([
      { id: "vip", name: "VIP", description: "Texte personnalisé", cover_url: "https://example.com/vip.jpg", duration_days: 30, max_devices: 2, price_cents: 990, features: [] },
    ]);
  });
  it("exclut les formules désactivées de l'affichage et de la commande", () => {
    const offers = { resellerOffers: [], subscriptionPlans: [{ ...vip, is_enabled: false }] };
    expect(enabledSubscriptionPlans(offers)).toEqual([]);
    expect(catalogPlans(offers)).toEqual([]);
  });
  it("ne transforme pas une autre devise en prix EUR", () => {
    expect(planPriceCents({ ...vip, currency: "USD" })).toBeNull();
  });
  it("refuse les prix manquants, négatifs ou non finis", () => {
    for (const price_eur of [null, undefined, -1, Infinity, NaN]) {
      expect(planPriceCents({ ...vip, price_eur })).toBeNull();
    }
  });
  it("reste compatible avec les formules sans les nouveaux champs optionnels", () => {
    const { is_enabled, currency, ...legacy } = vip;
    expect(catalogPlans({ resellerOffers: [], subscriptionPlans: [legacy] })[0]?.price_cents).toBe(990);
  });
});