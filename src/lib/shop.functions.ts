import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hypertv, HypertvError } from "./hypertvClient.server";
import { isRetryableCode, normalizeMac, MAC_REGEX, translateHypertvError } from "./hypertv-shared";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Accès réservé à l'administrateur de la boutique.");
}
function errInfo(e: unknown) {
  if (e instanceof HypertvError)
    return { status: e.status, code: e.code, message: translateHypertvError(e.status, e.code, e.message) };
  return { status: 500, code: "unknown", message: "Erreur inattendue." };
}
async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// ---------- Public ----------
export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [offers, sb] = await Promise.all([hypertv.getOffers(), publicClient()]);
    const { data: prices } = await sb.from("products").select("plan_id, price_cents, active");
    const map = new Map((prices ?? []).map((p: any) => [p.plan_id, p]));
    const plans = offers.subscriptionPlans
      .map((p) => {
        const pr: any = map.get(p.id);
        return pr && pr.active
          ? { id: p.id, name: p.name, duration_days: p.duration_days, max_devices: p.max_devices, price_cents: pr.price_cents as number }
          : null;
      })
      .filter(Boolean) as { id: string; name: string; duration_days: number; max_devices: number; price_cents: number }[];
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
    const sb = await publicClient();
    const { data: product } = await sb.from("products").select("price_cents, active").eq("plan_id", data.planId).maybeSingle();
    if (!plan || !product || !product.active) throw new Error("Cette formule n'est plus disponible.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = crypto.randomUUID();
    const { error } = await supabaseAdmin.from("orders").insert({
      id, email: data.email, mac: data.mac, plan_id: plan.id, plan_name: plan.name,
      price_cents: product.price_cents, idempotency_key: id,
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

// Active une commande payée. Idempotent : même clé = jamais deux débits.
async function runActivation(id: string) {
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

// ---------- Admin ----------
export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return !!data;
  });

// Emplacement Stripe : le futur webhook appellera la même logique (paid -> runActivation).
export const simulatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("orders").update({ payment_status: "paid", activation_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("payment_status", "pending");
    await runActivation(data.id);
    const n = await loadOrder(data.id);
    return n ? publicOrder(n) : null;
  });

export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const wrap = async <T,>(fn: () => Promise<T>) => {
      try { return { ok: true as const, data: await fn() }; }
      catch (e) { return { ok: false as const, error: errInfo(e) }; }
    };
    const [offers, balance, customers] = await Promise.all([
      wrap(hypertv.getOffers), wrap(hypertv.getBalance), wrap(hypertv.getCustomers),
    ]);
    return { offers, balance, customers };
  });

export const adminTestActivate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      mac: z.string().transform(normalizeMac).refine((m) => MAC_REGEX.test(m), "Adresse MAC invalide"),
      planId: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    try {
      const r = await hypertv.activate({ mac: data.mac, planId: data.planId, idempotencyKey: `test-${crypto.randomUUID()}` });
      return { ok: true, response: r as unknown as Record<string, unknown> };
    } catch (e) {
      const i = errInfo(e);
      return { ok: false, response: { status: i.status, error: i.code, message: i.message } as Record<string, unknown> };
    }
  });

export const adminPrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const offers = await hypertv.getOffers().catch(() => null);
    const { data } = await context.supabase.from("products").select("*");
    return {
      plans: offers?.subscriptionPlans ?? [],
      products: (data ?? []) as { plan_id: string; price_cents: number; active: boolean }[],
      error: offers ? null : "Impossible de récupérer les formules HyperTV.",
    };
  });

export const savePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ planId: z.string().min(1).max(100), priceCents: z.number().int().min(0).max(10_000_000), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase.from("products").upsert({
      plan_id: data.planId, price_cents: data.priceCents, active: data.active, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Enregistrement impossible.");
    return { ok: true };
  });
