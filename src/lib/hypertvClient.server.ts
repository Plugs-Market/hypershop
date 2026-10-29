// Seul module qui parle à l'API HyperTV. Serveur uniquement.
import type { OffersResponse } from "./shop-offers";

const BASE_URL = "https://hypertv.win/api/public/shop/v1";

export type { SubscriptionPlan } from "./shop-offers";
export type Customer = {
  mac: string;
  username: string;
  activatedAt: string;
  status: string;
  expiresAt: string;
  plan: string;
};
export type ActivateResult = {
  ok: boolean;
  mac: string;
  username: string;
  plan: string;
  expiresAt: string;
  credits: number;
  replayed?: boolean;
};

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
    throw new HypertvError(res.status, res.status === 422 ? "message" : err, message);
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

export const hypertv = {
  getShop: () => call<ShopInfo>("/shop"),
  getOffers: () => call<OffersResponse>("/offers"),
  getBalance: () => call<{ credits: number }>("/balance"),
  getCustomers: () => call<{ customers: Customer[] }>("/customers"),
  activate: (body: { mac: string; planId: string; idempotencyKey: string }) =>
    call<ActivateResult>("/activate", { method: "POST", body }),
};
