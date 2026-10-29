import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createOrder, getCatalog, getPaymentMethods } from "@/lib/shop.functions";
import { formatPrice, isValidMac, normalizeMac } from "@/lib/hypertv-shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const { data } = useSuspenseQuery(catalogQuery);
  const { data: methodsData } = useSuspenseQuery(methodsQuery);
  const navigate = useNavigate();
  const create = useServerFn(createOrder);
  const [selected, setSelected] = useState(planId);
  const [mac, setMac] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Générée une seule fois par tentative : un double clic ne crée pas deux commandes.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const buyable = data.plans.filter((p) => p.price_cents !== null) as ((typeof data.plans)[number] & { price_cents: number })[];
  const plan = buyable.find((p) => p.id === selected);
  const methods = methodsData.methods;
  const selectedMethod = methods.find((m) => m.code === method);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidMac(mac)) return setError("Format attendu : XX:XX:XX:XX:XX:XX (chiffres 0-9 et lettres A-F).");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Adresse email invalide.");
    if (!plan) return setError("Choisissez une formule.");
    if (!method) return setError("Choisissez un mode de paiement.");
    setLoading(true);
    try {
      const r = await create({ data: { planId: plan.id, email, mac: normalizeMac(mac), method, idempotencyKey } });
      navigate({ to: "/commande/$id", params: { id: r.id } });
    } catch (err) {
      setError((err as Error).message || "Erreur lors de la commande.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <SiteHeader name={data.shop.name} logoUrl={data.shop.logoUrl} />
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-3xl font-bold">Votre commande</h1>
        <form onSubmit={submit} className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6">
          <div className="space-y-2">
            <Label>Formule</Label>
            <div className="grid gap-2">
              {buyable.map((p) => (
                <button type="button" key={p.id} onClick={() => setSelected(p.id)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${p.id === selected ? "border-primary bg-accent" : "border-border hover:border-primary/50"}`}>
                  <span><span className="font-semibold">{p.name}</span> <span className="text-muted-foreground">· {p.duration_days} j · {p.max_devices} écran{p.max_devices > 1 ? "s" : ""}</span></span>
                  <span className="font-bold">{formatPrice(p.price_cents)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mac">Adresse MAC de l'appareil</Label>
            <Input id="mac" value={mac} onChange={(e) => setMac(e.target.value.toUpperCase())} placeholder="00:1A:79:AB:CD:EF" maxLength={17} className="font-mono" />
            <p className="text-xs text-muted-foreground">Visible dans HyperTV › Profil › Appareils MAG.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" />
          </div>
          <div className="space-y-2">
            <Label>Mode de paiement</Label>
            {methodsData.error && <p className="text-sm text-destructive">{methodsData.error}</p>}
            <div className="grid gap-2" role="radiogroup" aria-label="Mode de paiement">
              {methods.map((m) => (
                <button type="button" key={m.code} role="radio" aria-checked={method === m.code} onClick={() => setMethod(m.code)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition ${method === m.code ? "border-primary bg-accent" : "border-border hover:border-primary/50"}`}>
                  <span className="font-semibold">{m.label}</span>
                  {m.code === "paypal_ff" && (m.minEur !== null || m.maxEur !== null) && (
                    <span className="block text-xs text-muted-foreground">
                      De {m.minEur ?? 0} € à {m.maxEur ?? "∞"} €
                    </span>
                  )}
                  {m.code === "paypal_ff" && m.instructions && (
                    <span className="mt-1 block text-xs text-muted-foreground">{m.instructions}</span>
                  )}
                </button>
              ))}
            </div>
            {selectedMethod?.code === "paypal_ff" && selectedMethod.instructions && (
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">{selectedMethod.instructions}</p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
            {loading ? "Création…" : plan ? `Commander — ${formatPrice(plan.price_cents)}` : "Commander"}
          </Button>
          <p className="text-center text-xs text-muted-foreground"><Link to="/" className="underline">Retour aux formules</Link></p>
        </form>
      </main>
    </div>
  );
}
