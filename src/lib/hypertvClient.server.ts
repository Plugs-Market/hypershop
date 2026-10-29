// Seul module qui parle à l'API HyperTV. Serveur uniquement.
import type { OffersResponse } from "./shop-offers";
import type { OrderInput, OrderProgress } from "./shop-order";

const BASE_URL = "https://hypertv.win/api/public/shop/v1";

export type { SubscriptionPlan } from "./shop-offers";

export class HypertvError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const key = process.env["HYPERTV_SHOP_KEY"];
  if (!key) throw new HypertvError(500, "unauthorized", "Clé boutique absente");
  let res: Response;
  try {
    res = await fetch(BASE_URL + path, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError")
      throw new HypertvError(0, "timeout", "Délai dépassé");
    throw new HypertvError(0, "network_error", "Erreur réseau");
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = typeof json?.error === "string" ? json.error : "unknown";
    const message = typeof json?.message === "string" ? json.message : err;
    throw new HypertvError(res.status, err, message);
  }
  return json as T;
}

export type ShopInfo = {
  name: string;
  domain?: string | null;
  slogan?: string | null;
  description?: string | null;
  logoUrl?: string | null;
};

export type PaymentMethod = {
  code: string;
  label: string;
  symbol: string | null;
  minEur: number | null;
  maxEur: number | null;
  instructions: string | null;
  txidDeclaration: boolean;
};

export type OrderPayment = {
  method: string;
  label: string;
  amount?: string | number | null;
  symbol?: string | null;
  address?: string | null;
  memo?: string | null;
};

export type ShopOrder = OrderProgress & {
  id: string;
  state: string;
  plan: string;
  planId?: string;
  trexPlanId?: string;
  priceEur: number;
  mac: string;
  email: string;
  expiresAt: string | null;
  subscriptionExpiresAt: string | null;
  payment: OrderPayment;
};

export const hypertv = {
  getShop: () => call<ShopInfo>("/shop"),
  getOffers: () => call<OffersResponse>("/offers"),
  getPaymentMethods: () => call<{ methods: PaymentMethod[] }>("/payment-methods"),
  // L'API enveloppe la commande dans { order: … } ; on accepte aussi la réponse directe.
  createOrder: async (body: OrderInput) => {
    const json = await call<ShopOrder | { order: ShopOrder }>("/orders", { method: "POST", body });
    return "order" in json ? json.order : json;
  },
  getOrder: async (id: string) => {
    const json = await call<ShopOrder | { order: ShopOrder }>(`/orders/${encodeURIComponent(id)}`);
    return "order" in json ? json.order : json;
  },
  stripeCheckout: (id: string, returnUrl: string) =>
    call<{ url: string }>(`/orders/${encodeURIComponent(id)}/stripe-checkout`, { method: "POST", body: { returnUrl } }),
  paypalTxid: (id: string, body: { txid: string; paypalEmail: string; name: string }) =>
    call<{ ok: boolean }>(`/orders/${encodeURIComponent(id)}/paypal-txid`, { method: "POST", body }),
};
