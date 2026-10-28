import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Clock, MonitorSmartphone, Zap } from "lucide-react";
import { getCatalog } from "@/lib/shop.functions";
import { formatPrice } from "@/lib/hypertv-shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

const catalogQuery = queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HyperTV — Abonnements activés instantanément" },
      { name: "description", content: "Choisissez votre formule HyperTV et activez votre appareil automatiquement après paiement." },
      { property: "og:title", content: "HyperTV — Abonnements activés instantanément" },
      { property: "og:description", content: "Formules HyperTV, activation automatique sur votre appareil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);
  return (
    <div className="min-h-screen bg-gradient-hero">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="py-16 text-center md:py-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" /> Activation automatique après paiement
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold md:text-6xl">
            Votre abonnement <span className="text-primary">HyperTV</span>, prêt en quelques secondes
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
            <article key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 transition hover:border-primary/60 hover:shadow-glow">
              <h2 className="text-xl font-bold">{p.name}</h2>
              <p className="mt-4 text-4xl font-extrabold">{formatPrice(p.price_cents)}</p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {p.duration_days} jours</li>
                <li className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-primary" /> {p.max_devices} écran{p.max_devices > 1 ? "s" : ""}</li>
              </ul>
              <Button asChild variant="hero" className="mt-6 w-full">
                <Link to="/commander/$planId" params={{ planId: p.id }}>Choisir</Link>
              </Button>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
