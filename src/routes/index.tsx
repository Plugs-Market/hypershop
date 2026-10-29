import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Clock, MonitorSmartphone, Zap } from "lucide-react";
import { getCatalog } from "@/lib/shop.functions";
import { formatPrice } from "@/lib/hypertv-shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

const catalogQuery = queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog() });
type Catalog = Awaited<ReturnType<typeof getCatalog>>;

export const Route = createFileRoute("/")({
  head: ({ loaderData }) => {
    const data = loaderData as { shopName?: string | null } | undefined;
    const shopName = data?.shopName ?? "Boutique";
    return {
      meta: [
        { title: `${shopName} — Abonnements activés instantanément` },
        { name: "description", content: "Choisissez votre formule et activez votre appareil automatiquement après paiement." },
        { property: "og:title", content: `${shopName} — Abonnements activés instantanément` },
        { property: "og:description", content: "Formules, activation automatique sur votre appareil." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  loader: ({ context }): Promise<Catalog> => context.queryClient.ensureQueryData(catalogQuery),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);
  const shopName = data.shopName ?? null;
  return (
    <div className="min-h-screen bg-gradient-hero">
      <SiteHeader name={shopName} />
      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="py-16 text-center md:py-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" /> Activation automatique après paiement
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold md:text-6xl">
            Votre abonnement {shopName && <span className="text-primary">{shopName}</span>}, prêt en quelques secondes
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Choisissez une formule, saisissez l'adresse MAC de votre appareil, c'est tout.
          </p>
        </section>

        {data.error && <p className="text-center text-destructive">{data.error}</p>}
        {!data.error && data.plans.length === 0 && (
          <p className="text-center text-muted-foreground">Aucune formule disponible pour le moment.</p>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.plans.map((p) => (
            <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/60 hover:shadow-glow">
              {p.cover_url && <img src={p.cover_url} alt={p.name} loading="lazy" className="aspect-video w-full object-cover" />}
              <div className="flex flex-1 flex-col p-6">
              <h2 className="text-xl font-bold">{p.name}</h2>
              {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
              <p className="mt-4 text-3xl font-extrabold">{p.price_cents !== null ? formatPrice(p.price_cents) : <span className="text-base font-medium text-muted-foreground">Prix bientôt disponible</span>}</p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {p.duration_days} jours</li>
                <li className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-primary" /> {p.max_devices} écran{p.max_devices > 1 ? "s" : ""}</li>
                {p.features.map((f) => <li key={f} className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> {f}</li>)}
              </ul>
              <div className="mt-auto pt-6">
              {p.price_cents !== null ? (
                <Button asChild variant="hero" className="w-full"><Link to="/commander/$planId" params={{ planId: p.id }}>Choisir</Link></Button>
              ) : <Button variant="secondary" className="w-full" disabled>Bientôt disponible</Button>}
              </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
