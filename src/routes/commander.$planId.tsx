import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { createOrder, getCatalog, getPaymentMethods } from "@/lib/shop.functions";
import { formatPrice, isValidMac, normalizeMac } from "@/lib/hypertv-shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveOrderAttempt, type OrderAttempt } from "@/lib/shop-order";

const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
  staleTime: 0,
  refetchOnMount: "always",
});
const methodsQuery = queryOptions({
  queryKey: ["payment-methods"],
  queryFn: () => getPaymentMethods(),
  staleTime: 0,
  refetchOnMount: "always",
});
type Catalog = Awaited<ReturnType<typeof getCatalog>>;

export const Route = createFileRoute("/commander/$planId")({
  validateSearch: (search: Record<string, unknown>): { type?: "trex" } => (search["type"] === "trex" ? { type: "trex" } : {}),
  head: ({ loaderData }) => {
    const data = loaderData as Catalog | undefined;
    const shopName = data?.shop?.name ?? "Boutique";
    return {
      meta: [
        { title: `Commander — ${shopName}` },
        { name: "description", content: "Finalisez votre commande d'abonnement." },
        { property: "og:title", content: `Commander — ${shopName}` },
        { property: "og:description", content: "Finalisez votre commande d'abonnement." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  loader: async ({ context }): Promise<Catalog> => {
    const [catalog] = await Promise.all([
      context.queryClient.ensureQueryData(catalogQuery),
      context.queryClient.ensureQueryData(methodsQuery),
    ]);
    return catalog;
  },
  component: Checkout,
});

function Checkout() {
  const { planId } = Route.useParams();
  const { type } = Route.useSearch();
  const isTrex = type === "trex";
  const { data } = useSuspenseQuery(catalogQuery);
  const { data: methodsData } = useSuspenseQuery(methodsQuery);
  const navigate = useNavigate();
  const create = useServerFn(createOrder);
  const [selected, setSelected] = useState(planId);
  const [mac, setMac] = useState("");
  const [method, setMethod] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Conservée après un échec réseau ; renouvelée seulement si le contenu de la tentative change.
  const attempt = useRef<OrderAttempt | null>(null);
  const submitting = useRef(false);
  const available = isTrex ? data.trexPlans : data.plans;
  const buyable = available.filter((p): p is typeof p & { price_cents: number } => p.price_cents !== null);
  const plan = buyable.find((p) => p.id === selected);
  const isFree = plan?.price_cents === 0;
  const methods = methodsData.methods;
  const selectedMethod = methods.find((m) => m.code === method);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    setError(null);
    if (!isValidMac(mac)) return setError("Format attendu : XX:XX:XX:XX:XX:XX (chiffres 0-9 et lettres A-F).");
    if (!plan) return setError("Choisissez une formule.");
    if (!isFree && !method) return setError("Choisissez un mode de paiement.");
    submitting.current = true;
    setLoading(true);
    const details = isFree ? { mac: normalizeMac(mac) } : { mac: normalizeMac(mac), method: method! };
    const product = isTrex ? { trexPlanId: plan.id } : { planId: plan.id };
    attempt.current = resolveOrderAttempt(attempt.current, JSON.stringify({ ...product, ...details }), () => crypto.randomUUID());
    try {
      const r = await create({ data: { ...product, ...details, idempotencyKey: attempt.current.key } });
      await navigate({ to: "/commande/$id", params: { id: r.id } });
    } catch (err) {
      setError((err as Error).message || "Erreur lors de la commande.");
      setLoading(false);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <SiteHeader name={data.shop.name} logoUrl={data.shop.logoUrl} />
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-3xl font-bold">Votre commande</h1>
        <form onSubmit={submit} className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6">
          <div className="space-y-2">
            <Label>{isTrex ? "Abonnement TREX" : "Formule"}</Label>
            {data.error && <p className="text-sm text-destructive">{data.error}</p>}
            {!data.error && !plan && <p className="text-sm text-destructive">Cette formule n'est plus disponible</p>}
            <div className="grid gap-2">
              {buyable.map((p) => (
                <Button variant="outline" type="button" key={p.id} disabled={loading} onClick={() => setSelected(p.id)}
                  className={`h-auto min-h-12 justify-between gap-3 whitespace-normal rounded-lg px-4 py-3 text-left text-sm ${p.id === selected ? "border-primary bg-accent" : "border-border hover:border-primary/50"}`}>
                  <span className="min-w-0"><span className="font-semibold">{p.name}</span> <span className="block text-muted-foreground">{"line" in p ? <>Ligne M3U {p.line.months} mois{p.includesHypertvSubscription && <span className="mt-1 block">+ Abonnement HyperTV {p.includesHypertvSubscription.name} ({p.includesHypertvSubscription.maxDevices} écrans)</span>}</> : <>{p.duration_days} j · {p.max_devices} écran{p.max_devices > 1 ? "s" : ""}</>}</span></span>
                  <span className="shrink-0 font-bold">{formatPrice(p.price_cents)}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mac">Adresse MAC de l'appareil</Label>
            <Input id="mac" value={mac} onChange={(e) => setMac(e.target.value.toUpperCase())} placeholder="00:1A:79:AB:CD:EF" maxLength={17} className="font-mono" />
            <p className="text-xs text-muted-foreground">Visible dans HyperTV › Profil › Appareils MAG.</p>
          </div>
          {!isFree && (
          <div className="space-y-2">
            <Label>Mode de paiement</Label>
            {methodsData.error && <p className="text-sm text-destructive">{methodsData.error}</p>}
            <div className="grid gap-2" role="radiogroup" aria-label="Mode de paiement">
              {methods.map((m) => (
                <Button variant="outline" type="button" key={m.code} disabled={loading} role="radio" aria-checked={method === m.code} onClick={() => setMethod(m.code)}
                  className={`h-auto flex-col items-start rounded-lg px-4 py-3 text-left text-sm ${method === m.code ? "border-primary bg-accent" : "border-border hover:border-primary/50"}`}>
                  <span className="font-semibold">{m.label}</span>
                  {m.code === "paypal_ff" && (m.minEur !== null || m.maxEur !== null) && (
                    <span className="block text-xs text-muted-foreground">
                      De {m.minEur ?? 0} € à {m.maxEur ?? "∞"} €
                    </span>
                  )}
                </Button>
              ))}
            </div>
            {selectedMethod?.code === "paypal_ff" && selectedMethod.instructions && (
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">{selectedMethod.instructions}</p>
            )}
          </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading || !plan}>
            {loading ? "Création…" : plan ? `Commander — ${formatPrice(plan.price_cents)}` : "Commander"}
          </Button>
          <p className="text-center text-xs text-muted-foreground"><Link to="/" className="underline">Retour aux formules</Link></p>
        </form>
      </main>
    </div>
  );
}
