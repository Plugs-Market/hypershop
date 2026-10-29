import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hypertv, HypertvError } from "./hypertvClient.server";
import { translateHypertvError } from "./hypertv-shared";
import { catalogPlans, catalogTrexPlans } from "./shop-offers";
import { orderInputSchema } from "./shop-order";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { ownerHash, ownsOrder, hashValue } from "./order-access.server";
import { canReadDelivery } from "./playlist-security";

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
    return { plans, trexPlans: catalogTrexPlans(offers), shop: shopInfo(shop), error: null as string | null };
  } catch (e) {
    console.error("getCatalog failed", e instanceof HypertvError ? e.code : e);
    return { plans: [], trexPlans: [], shop: shopInfo(null), error: "Catalogue momentanément indisponible." };
  }
});

// Identité de la boutique (nom, slogan, description, logo), définie dans le panel revendeur.
export type ShopIdentity = {
  name: string | null;
  slogan: string | null;
  description: string | null;
  logoUrl: string | null;
  guidesEnabled: boolean;
};
export function shopInfo(s: { name?: string; slogan?: string | null; description?: string | null; logoUrl?: string | null; guides?: { enabled?: boolean } | null } | null): ShopIdentity {
  return {
    name: s?.name ?? null,
    slogan: s?.slogan ?? null,
    description: s?.description ?? null,
    logoUrl: s?.logoUrl ?? null,
    guidesEnabled: s?.guides?.enabled === true,
  };
}

export const getShopInfo = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return shopInfo(await hypertv.getShop());
  } catch {
    return shopInfo(null);
  }
});

// Palette revendeur (cache 5 min). Invalide ou erreur → null : styles.css sert de repli.
export const getShopTheme = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { buildThemeCss } = await import("./shop-theme");
    const shop = await hypertv.getShopCached();
    const css = buildThemeCss(shop.theme);
    if (!css) return null;
    return { css, background: (shop.theme as { background: string }).background };
  } catch {
    return null;
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

// Crée la commande côté HyperTV : le prix facturé est toujours celui de l'API.
// L'idempotencyKey (générée une fois par tentative côté navigateur) évite les doublons.
export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => orderInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      setResponseHeader("Cache-Control", "no-store");
      const hash = await ownerHash(true);
      if (!hash) throw new Error("Accès sécurisé indisponible.");
      const requestHash = await hashValue(JSON.stringify(data));
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: reserveError } = await supabaseAdmin.from("shop_order_access").upsert({ attempt_id: data.idempotencyKey, owner_hash: hash, request_hash: requestHash }, { onConflict: "attempt_id", ignoreDuplicates: true });
      const { data: proof, error: proofError } = await supabaseAdmin.from("shop_order_access").select("owner_hash,request_hash").eq("attempt_id", data.idempotencyKey).maybeSingle();
      if (reserveError || proofError || proof?.owner_hash !== hash || proof.request_hash !== requestHash) { console.error("checkout ownership failure", reserveError?.code ?? proofError?.code ?? "proof_mismatch"); throw new Error("Tentative non autorisée."); }
      const order = await hypertv.createOrder(data);
      const { error } = await supabaseAdmin.from("shop_order_access").update({ order_id: order.id }).eq("attempt_id", data.idempotencyKey).eq("owner_hash", hash);
      if (error) throw new Error("Suivi sécurisé indisponible. Réessayez cette même commande.");
      return { id: order.id };
    } catch (e) {
      console.error("checkout failed", e instanceof HypertvError ? e.code : "ownership_failure");
      throw new Error(errMessage(e));
    }
  });

const idSchema = z.object({ id: z.string().uuid() });

export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      setResponseHeader("Cache-Control", "no-store");
      const authorized = await ownsOrder(data.id);
      const order = await hypertv.getOrder(data.id);
      // Never serialize delivery into loader/SSR hydration or router caches.
      return { ...order, delivery: null, deliveryError: authorized ? order.deliveryError : null, deliveryAuthorized: authorized };
    } catch (e) {
      if (e instanceof HypertvError && e.status === 404) return null;
      throw new Error(errMessage(e));
    }
  });

export const getDelivery = createServerFn({ method: "POST" })
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    if (!(await ownsOrder(data.id))) return { delivery: null, error: "Accès privé : ouvrez le suivi depuis le navigateur utilisé pour votre achat." };
    try {
      const order = await hypertv.getOrder(data.id);
      if (!canReadDelivery(order, true)) return { delivery: null, error: "Les accès seront disponibles après activation." };
      return { delivery: order.delivery ?? null, error: order.delivery ? null : "Vos accès IPTV sont momentanément indisponibles. Réessayez dans quelques instants." };
    } catch { return { delivery: null, error: "Impossible de récupérer vos accès. Réessayez." }; }
  });

// Raw HTTP entry point calls this server-only wrapper, never its RPC stub.
import { createServerOnlyFn } from "@tanstack/react-start";
export const downloadPlaylist = createServerOnlyFn(async (id: string) => {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
  if (!z.string().uuid().safeParse(id).success || !(await ownsOrder(id))) return new Response("Accès non autorisé.", { status: 403, headers });
  if (getRequestHeader("sec-fetch-site") === "cross-site") return new Response("Accès non autorisé.", { status: 403, headers });
  try {
    const order = await hypertv.getOrder(id);
    if (!canReadDelivery(order, true) || !order.delivery?.m3uUrl) return new Response("Playlist indisponible. Réessayez après activation.", { status: 409, headers });
    const { fetchPlaylist } = await import("./playlist-download.server");
    const bytes = await fetchPlaylist(order.delivery.m3uUrl);
    return new Response(new Blob([bytes as BlobPart], { type: "audio/x-mpegurl" }), { headers: { ...headers, "Content-Type": "audio/x-mpegurl", "Content-Disposition": 'attachment; filename="playlist.m3u"' } });
  } catch { return new Response("Le téléchargement fournisseur est indisponible. Vous pouvez toujours copier le lien M3U.", { status: 502, headers }); }
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
