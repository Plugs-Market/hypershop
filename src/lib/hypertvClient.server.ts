// Seul module qui parle à l'API HyperTV. Serveur uniquement.
import type { OffersResponse } from "./shop-offers";
import type { OrderInput, OrderProgress } from "./shop-order";
import type { Delivery } from "./playlist-security";
import type { GuideCategoriesResponse, GuidesListResponse, GuideDetail } from "./guides";

const BASE_URL = "https://hypertv.win/api/public/shop/v1";

export type { SubscriptionPlan } from "./shop-offers";

export class HypertvError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: { method?: string; body?: unknown; session?: string }): Promise<T> {
  const key = process.env["HYPERTV_SHOP_KEY"];
  if (!key) throw new HypertvError(500, "unauthorized", "Clé boutique absente");
  let res: Response;
  try {
    res = await fetch(BASE_URL + path, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.session ? { "X-Customer-Session": init.session } : {}) },
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
  guides?: { enabled?: boolean; categoryIds?: string[] } | null;
  theme?: Record<string, unknown> | null;
  cssVariables?: string | null;
};

// Cache mémoire court (5 min) pour les guides.
const guideCache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(path: string): Promise<T> {
  const hit = guideCache.get(path);
  if (hit && Date.now() - hit.at < 300_000) return hit.value as T;
  const value = await call<T>(path);
  guideCache.set(path, { at: Date.now(), value });
  return value;
}


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
  delivery?: Delivery | null;
  deliveryError?: string | null;
  deliveryAuthorized?: boolean;
  id: string;
  state: string;
  plan: string;
  planId?: string;
  trexPlanId?: string;
  priceEur: number;
  mac: string;
  email?: string | null;
  expiresAt: string | null;
  subscriptionExpiresAt: string | null;
  payment: OrderPayment;
};

export const hypertv = {
  getShop: () => call<ShopInfo>("/shop"),
  getShopCached: () => cached<ShopInfo>("/shop"),
  getApps: () => cached<unknown>("/apps"),
  getGuideCategories: () => cached<GuideCategoriesResponse>("/guides/categories"),
  listGuides: (category?: string) =>
    cached<GuidesListResponse>("/guides" + (category ? `?category=${encodeURIComponent(category)}` : "")),
  getGuide: async (slug: string) => {
    try {
      return await cached<GuideDetail>(`/guides/${encodeURIComponent(slug)}`);
    } catch (e) {
      if (e instanceof HypertvError && e.status === 404) return null;
      throw e;
    }
  },
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
  login: (accessKey: string) =>
    call<{ mfaRequired?: boolean; session?: string; mfaToken?: string }>("/account/login", { method: "POST", body: { accessKey } }),
  loginMfa: (mfaToken: string, code: string) =>
    call<{ session?: string }>("/account/login/mfa", { method: "POST", body: { mfaToken, code } }),
  getAccount: (session: string) => call<unknown>("/account", { session }),
  updateAccount: (session: string, username: string) =>
    call<unknown>("/account", { method: "PATCH", body: { username }, session }),
  logout: (session: string) => call<unknown>("/account/logout", { method: "POST", session }),
};
