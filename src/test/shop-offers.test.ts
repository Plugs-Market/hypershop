import { describe, expect, it } from "vitest";
import { catalogPlans, catalogTrexPlans, enabledSubscriptionPlans, planPriceCents, type SubscriptionPlan, type TrexPlan } from "@/lib/shop-offers";

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
    const { price_eur: omittedPrice, ...withoutPrice } = vip;
    expect(planPriceCents(withoutPrice)).toBeNull();
    for (const price_eur of [null, -1, Infinity, NaN]) {
      expect(planPriceCents({ ...vip, price_eur })).toBeNull();
    }
  });
  it("reste compatible avec les formules sans les nouveaux champs optionnels", () => {
    const { is_enabled, currency, ...legacy } = vip;
    expect(catalogPlans({ resellerOffers: [], subscriptionPlans: [legacy] })[0]?.price_cents).toBe(990);
  });
});

describe("offres TREX", () => {
  const trex: TrexPlan = { id: "trex-12", type: "trex", title: "TREX annuel", price_eur: 59.90, currency: "EUR", line: { type: "m3u", months: 12, durationDays: 365 }, includesHypertvSubscription: { name: "PRO", durationDays: 365, maxDevices: 2 } };
  it("utilise uniquement le prix de l'API et conserve la ligne et l'abonnement inclus", () => {
    const [plan] = catalogTrexPlans({ resellerOffers: [{ id: "credit-pack" }], subscriptionPlans: [vip], trexPlans: [trex] });
    expect(plan?.price_cents).toBe(5990);
    expect(plan?.name).toBe("TREX annuel");
    expect(plan?.line).toEqual({ type: "m3u", months: 12, durationDays: 365 });
    expect(plan?.includesHypertvSubscription).toEqual({ name: "PRO", durationDays: 365, maxDevices: 2 });
  });
  it("reste compatible sans TREX", () => expect(catalogTrexPlans({ resellerOffers: [], subscriptionPlans: [vip] })).toEqual([]));
  it("conserve une ligne seule sans ajouter un abonnement HyperTV", () => expect(catalogTrexPlans({ resellerOffers: [], subscriptionPlans: [], trexPlans: [{ ...trex, includesHypertvSubscription: null }] })[0]?.includesHypertvSubscription).toBeNull());
  it("rend un prix absent ou non EUR non achetable", () => {
    for (const plan of [{ ...trex, price_eur: null }, { ...trex, currency: "USD" }]) {
      expect(catalogTrexPlans({ resellerOffers: [], subscriptionPlans: [], trexPlans: [plan] })[0]?.price_cents).toBeNull();
    }
  });
});