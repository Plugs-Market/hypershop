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
  return (await request<T>(path, init)).data as T;
}

async function request<T>(path: string, init?: { method?: string; body?: unknown; session?: string; headers?: Record<string, string> }): Promise<{ data: T | null; status: number; etag: string | null }> {
  const key = process.env["HYPERTV_SHOP_KEY"];
  if (!key) throw new HypertvError(500, "unauthorized", "Clé boutique absente");
  let res: Response;
  try {
    res = await fetch(BASE_URL + path, {
      method: init?.method ?? "GET",
      ...(init?.session ? { cache: "no-store" as const } : {}),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.session ? { "X-Customer-Session": init.session } : {}), ...(init?.headers ?? {}) },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError")
      throw new HypertvError(0, "timeout", "Délai dépassé");
    throw new HypertvError(0, "network_error", "Erreur réseau");
  }
  if (res.status === 304) return { data: null, status: 304, etag: res.headers.get("ETag") };
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
  return { data: json as T, status: res.status, etag: res.headers.get("ETag") };
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
   getPaymentMethods: (session?: string) => call<{ methods: PaymentMethod[] }>("/payment-methods", session ? { session } : undefined),
  // L'API enveloppe la commande dans { order: … } ; on accepte aussi la réponse directe.
  createOrder: async (body: OrderInput) => {
    const json = await call<ShopOrder | { order: ShopOrder }>("/orders", { method: "POST", body });
    return "order" in json ? json.order : json;
  },
  getOrder: async (id: string) => {
    const json = await call<ShopOrder | { order: ShopOrder }>(`/orders/${encodeURIComponent(id)}`);
    return "order" in json ? json.order : json;
  },
   stripeCheckout: (id: string, returnUrl: string, session?: string) =>
     call<{ url: string }>(`/orders/${encodeURIComponent(id)}/stripe-checkout`, { method: "POST", body: { returnUrl }, ...(session ? { session } : {}) }),
   paypalTxid: (id: string, body: { txid: string; paypalEmail: string; name?: string }, session?: string) =>
     call<{ ok: boolean }>(`/orders/${encodeURIComponent(id)}/paypal-txid`, { method: "POST", body, ...(session ? { session } : {}) }),
   getInvoices: (session: string, search: { status: string; method: string; q: string; page: number }) =>
     call<unknown>(`/account/invoices?${new URLSearchParams({ ...search, page: String(search.page) })}`, { session }),
   getInvoice: (session: string, id: string) => call<unknown>(`/account/invoices/${encodeURIComponent(id)}`, { session }),
   payInvoice: (session: string, id: string, method: string) => call<unknown>(`/account/invoices/${encodeURIComponent(id)}/pay`, { method: "POST", session, body: { method } }),
   cancelInvoice: (session: string, id: string) => call<unknown>(`/account/invoices/${encodeURIComponent(id)}/cancel`, { method: "POST", session }),
  login: (accessKey: string) =>
    call<{ mfaRequired?: boolean; session?: string; mfaToken?: string }>("/account/login", { method: "POST", body: { accessKey } }),
  loginMfa: (mfaToken: string, code: string) =>
    call<{ session?: string }>("/account/login/mfa", { method: "POST", body: { mfaToken, code } }),
  getAccount: (session: string) => call<unknown>("/account", { session }),
  updateAccount: (session: string, username: string) =>
    call<unknown>("/account", { method: "PATCH", body: { username }, session }),
  logout: (session: string) => call<unknown>("/account/logout", { method: "POST", session }),
  // Support chiffré : le serveur ne relaie que des données chiffrées.
  supportRegisterDevice: (session: string, body: { publicKey: string; label: string }) =>
    call<{ deviceId?: string; id?: string }>("/account/support/devices", { method: "POST", body, session }),
  supportTickets: (session: string) => call<unknown>("/account/support/tickets", { session }),
  supportCreate: (session: string, body: unknown) => call<unknown>("/account/support/tickets", { method: "POST", body, session }),
  supportKeys: (session: string, id: string, keys: unknown[]) =>
    call<unknown>(`/account/support/tickets/${encodeURIComponent(id)}/keys`, { method: "POST", body: { keys }, session }),
  supportTicket: (session: string, id: string, deviceId: string, opts: { after?: string | undefined; includeDevices?: boolean | undefined; etag?: string | undefined } = {}) =>
    request<unknown>(`/account/support/tickets/${encodeURIComponent(id)}?${new URLSearchParams({ deviceId, ...(opts.after ? { after: opts.after } : {}), ...(opts.includeDevices ? { include: "devices" } : {}) })}`, { session, ...(opts.etag ? { headers: { "If-None-Match": opts.etag } } : {}) }),
  supportMessage: (session: string, id: string, body: { ct: string; iv: string }) =>
    call<any>(`/account/support/tickets/${encodeURIComponent(id)}/messages`, { method: "POST", body, session }),
  supportUploads: (session: string, id: string, files: { mime: string; size: number }[]) =>
    call<unknown>(`/account/support/tickets/${encodeURIComponent(id)}/attachments`, { method: "POST", body: { files }, session }),
  supportAttachment: (session: string, id: string, path: string) =>
    call<unknown>(`/account/support/tickets/${encodeURIComponent(id)}/attachments?${new URLSearchParams({ path })}`, { session }),
  supportStatus: (session: string, id: string, body: { expected: string; status: string; ct: string; iv: string }) =>
    call<unknown>(`/account/support/tickets/${encodeURIComponent(id)}/status`, { method: "POST", body, session }),
  supportRead: (session: string, id: string) =>
    call<unknown>(`/account/support/tickets/${encodeURIComponent(id)}/read`, { method: "POST", body: {}, session }),
};

// Flux SSE brut (événements sans contenu), relayé tel quel au navigateur.
export async function openSupportStream(session: string, signal: AbortSignal): Promise<Response> {
  const key = process.env["HYPERTV_SHOP_KEY"];
  if (!key) return new Response(null, { status: 500 });
  return fetch(BASE_URL + "/account/support/stream", {
    headers: { Authorization: `Bearer ${key}`, "X-Customer-Session": session, Accept: "text/event-stream" },
    cache: "no-store",
    signal,
  });
}
