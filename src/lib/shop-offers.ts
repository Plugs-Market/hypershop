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
  trexPlans?: TrexPlan[];
};

export type TrexPlan = {
  id: string;
  type: "trex";
  title: string;
  description?: string | null;
  cover_url?: string | null;
  price_eur?: number | null;
  currency: string;
  line: { type: "m3u"; months: number; durationDays: number };
  includesHypertvSubscription: null | { name: string; durationDays: number; maxDevices: number };
};

export function planPriceCents(plan: Pick<SubscriptionPlan, "currency" | "price_eur">): number | null {
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

export function catalogTrexPlans(offers: OffersResponse) {
  return (offers.trexPlans ?? []).filter((plan) => plan.type === "trex").map((plan) => ({
    id: plan.id,
    name: plan.title,
    description: plan.description ?? null,
    cover_url: plan.cover_url ?? null,
    price_cents: planPriceCents(plan),
    line: plan.line,
    includesHypertvSubscription: plan.includesHypertvSubscription ?? null,
  }));
}