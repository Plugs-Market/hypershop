import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hypertv, HypertvError } from "./hypertvClient.server";
import { normalizeMac, MAC_REGEX, translateHypertvError } from "./hypertv-shared";
import { catalogPlans } from "./shop-offers";

function errMessage(e: unknown): string {
  if (e instanceof HypertvError) return translateHypertvError(e.status, e.code, e.message);
  return "Erreur inattendue.";
}

// ---------- Public ----------
// Tout le catalogue vient de l'API HyperTV (géré depuis le panel revendeur).
export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [offers, shop] = await Promise.all([
      hypertv.getOffers(),
      hypertv.getShop().catch(() => null),
    ]);
    const plans = catalogPlans(offers);
    return { plans, shop: shopInfo(shop), error: null as string | null };
  } catch (e) {
    console.error("getCatalog failed", e instanceof HypertvError ? e.code : e);
    return { plans: [], shop: shopInfo(null), error: "Catalogue momentanément indisponible." };
  }
});

// Identité de la boutique (nom, slogan, description, logo), définie dans le panel revendeur.
export type ShopIdentity = {
  name: string | null;
  slogan: string | null;
  description: string | null;
  logoUrl: string | null;
};
function shopInfo(s: { name?: string; slogan?: string | null; description?: string | null; logoUrl?: string | null } | null): ShopIdentity {
  return {
    name: s?.name ?? null,
    slogan: s?.slogan ?? null,
    description: s?.description ?? null,
    logoUrl: s?.logoUrl ?? null,
  };
}

export const getShopInfo = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return shopInfo(await hypertv.getShop());
  } catch {
    return shopInfo(null);
  }
});

// Modes de paiement activés dans le panel revendeur (crypto, Stripe, PayPal…).
export const getPaymentMethods = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { methods } = await hypertv.getPaymentMethods();
    return { methods, error: null as string | null };
  } catch (e) {
    console.error("getPaymentMethods failed", e instanceof HypertvError ? e.code : e);
    return { methods: [], error: "Modes de paiement momentanément indisponibles." };
  }
});

const macField = z
  .string()
  .transform(normalizeMac)
  .refine((m) => MAC_REGEX.test(m), "Adresse MAC invalide");

// Crée la commande côté HyperTV : le prix facturé est toujours celui de l'API.
// L'idempotencyKey (générée une fois par tentative côté navigateur) évite les doublons.
export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        planId: z.string().min(1).max(100),
        email: z.string().trim().email().max(255),
        mac: macField,
        method: z.string().min(1).max(50),
        idempotencyKey: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const order = await hypertv.createOrder(data);
      return { id: order.id };
    } catch (e) {
      throw new Error(errMessage(e));
    }
  });

const idSchema = z.object({ id: z.string().uuid() });

export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      return await hypertv.getOrder(data.id);
    } catch (e) {
      if (e instanceof HypertvError && e.status === 404) return null;
      throw new Error(errMessage(e));
    }
  });

// Stripe : renvoie l'URL de paiement hébergée. order_not_payable → le client recharge la commande.
export const stripeCheckout = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), returnUrl: z.string().url().max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const r = await hypertv.stripeCheckout(data.id, data.returnUrl);
      return { ok: true as const, url: r.url };
    } catch (e) {
      return {
        ok: false as const,
        code: e instanceof HypertvError ? e.code : "unknown",
        message: errMessage(e),
      };
    }
  });

// PayPal « Entre proches » : déclaration de la transaction par le client.
export const paypalTxid = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        txid: z.string().trim().min(4).max(100),
        paypalEmail: z.string().trim().email().max(255),
        name: z.string().trim().min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      await hypertv.paypalTxid(data.id, { txid: data.txid, paypalEmail: data.paypalEmail, name: data.name });
      return { ok: true as const };
    } catch (e) {
      return {
        ok: false as const,
        code: e instanceof HypertvError ? e.code : "unknown",
        message: errMessage(e),
      };
    }
  });
