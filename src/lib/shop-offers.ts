// Normalisation du catalogue HyperTV, commune à l'affichage et à la commande.
export type SubscriptionPlan = {
  id: string;
  name: string;
  duration_days: number;
  max_devices: number;
  reseller_credits: number;
  description?: string | null;
  features?: string[];
  cover_url?: string | null;
  price_eur?: number | null;
  currency?: string;
  is_enabled?: boolean;
};

export type OffersResponse = {
  resellerOffers: unknown[];
  subscriptionPlans: SubscriptionPlan[];
};

export function planPriceCents(plan: SubscriptionPlan): number | null {
  if (plan.currency !== undefined && plan.currency !== "EUR") return null;
  return typeof plan.price_eur === "number" && Number.isFinite(plan.price_eur) && plan.price_eur >= 0
    ? Math.round(plan.price_eur * 100)
    : null;
}

export function enabledSubscriptionPlans(offers: OffersResponse): SubscriptionPlan[] {
  return offers.subscriptionPlans.filter((plan) => plan.is_enabled !== false);
}

export function catalogPlans(offers: OffersResponse) {
  return enabledSubscriptionPlans(offers).map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description ?? null,
    features: plan.features ?? [],
    cover_url: plan.cover_url ?? null,
    duration_days: plan.duration_days,
    max_devices: plan.max_devices,
    price_cents: planPriceCents(plan),
  }));
}