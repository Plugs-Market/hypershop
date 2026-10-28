import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hypertv, HypertvError } from "./hypertvClient.server";
import { isRetryableCode, normalizeMac, MAC_REGEX, translateHypertvError } from "./hypertv-shared";

function errInfo(e: unknown) {
  if (e instanceof HypertvError)
    return { status: e.status, code: e.code, message: translateHypertvError(e.status, e.code, e.message) };
  return { status: 500, code: "unknown", message: "Erreur inattendue." };
}
// ---------- Public ----------
function planPriceCents(p: { price_eur?: number | null }) {
  return typeof p.price_eur === "number" && p.price_eur >= 0 ? Math.round(p.price_eur * 100) : null;
}

// Tout le catalogue vient de l'API HyperTV (géré depuis le panel revendeur).
export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const offers = await hypertv.getOffers();
    const plans = offers.subscriptionPlans.map((p) => ({
      id: p.id, name: p.name, description: p.description ?? null, features: p.features ?? [],
      cover_url: p.cover_url ?? null, duration_days: p.duration_days, max_devices: p.max_devices,
      price_cents: planPriceCents(p),
    }));
    return { plans, error: null as string | null };
  } catch (e) {
    console.error("getCatalog failed", errInfo(e).code);
    return { plans: [], error: "Catalogue momentanément indisponible." };
  }
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        planId: z.string().min(1).max(100),
        email: z.string().trim().email().max(255),
        mac: z.string().transform(normalizeMac).refine((m) => MAC_REGEX.test(m), "Adresse MAC invalide"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const offers = await hypertv.getOffers();
    const plan = offers.subscriptionPlans.find((p) => p.id === data.planId);
    if (!plan) throw new Error("Cette formule n'est plus disponible.");
    const price = planPriceCents(plan);
    if (price === null) throw new Error("Le prix de cette formule n'est pas encore disponible.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = crypto.randomUUID();
    const { error } = await supabaseAdmin.from("orders").insert({
      id, email: data.email, mac: data.mac, plan_id: plan.id, plan_name: plan.name,
      price_cents: price, idempotency_key: id,
    });
    if (error) throw new Error("Impossible de créer la commande.");
    return { id };
  });

const idSchema = z.object({ id: z.string().uuid() });

async function loadOrder(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("orders").select("*").eq("id", id).maybeSingle();
  return data;
}
function publicOrder(o: any) {
  return {
    id: o.id, email: o.email, mac: o.mac, plan_name: o.plan_name, price_cents: o.price_cents,
    payment_status: o.payment_status as string, activation_status: o.activation_status as string,
    activation_error: o.activation_error as string | null, expires_at: o.expires_at as string | null,
    created_at: o.created_at as string,
  };
}

// Appelée après confirmation serveur du paiement (futur webhook Stripe).
// Active une commande payée. Idempotent : même clé = jamais deux débits.
export async function runActivation(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const o = await loadOrder(id);
  if (!o || o.payment_status !== "paid" || o.activation_status === "activated") return;
  try {
    const r = await hypertv.activate({ mac: o.mac, planId: o.plan_id, idempotencyKey: o.idempotency_key });
    await supabaseAdmin.from("orders").update({
      activation_status: "activated", activation_error: null, api_response: r as any,
      expires_at: r.expiresAt, updated_at: new Date().toISOString(),
    }).eq("id", id);
  } catch (e) {
    const info = errInfo(e);
    await supabaseAdmin.from("orders").update({
      activation_status: isRetryableCode(info.code) ? "pending_retry" : "failed",
      activation_error: info.message, api_response: { error: info.code, status: info.status },
      updated_at: new Date().toISOString(),
    }).eq("id", id);
  }
}

export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const o = await loadOrder(data.id);
    return o ? publicOrder(o) : null;
  });

export const retryActivation = createServerFn({ method: "POST" })
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const o = await loadOrder(data.id);
    if (o && o.payment_status === "paid" && o.activation_status !== "activated" && o.activation_status !== "failed")
      await runActivation(data.id);
    const n = await loadOrder(data.id);
    return n ? publicOrder(n) : null;
  });

