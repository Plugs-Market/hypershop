import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, CircleCheck, Clock, ListMusic, MonitorSmartphone, Tv, Zap } from "lucide-react";
import { getCatalog } from "@/lib/shop.functions";
import { trexLineLabels } from "@/lib/shop-offers";
import { formatPrice } from "@/lib/hypertv-shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

// Les URL d'images de l'API expirent après 24 h : on relit le catalogue à chaque visite.
const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
  staleTime: 0,
  refetchOnMount: "always",
});
type Catalog = Awaited<ReturnType<typeof getCatalog>>;

export const Route = createFileRoute("/")({
  head: ({ loaderData }) => {
    const data = loaderData as Catalog | undefined;
    const shop = data?.shop;
    const shopName = shop?.name ?? "Boutique";
    const desc = shop?.description ?? shop?.slogan ?? "Choisissez votre formule et activez votre appareil automatiquement après paiement.";
    return {
      meta: [
        { title: `${shopName} — Abonnements activés instantanément` },
        { name: "description", content: desc },
        { property: "og:title", content: `${shopName} — Abonnements activés instantanément` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  loader: ({ context }): Promise<Catalog> => context.queryClient.ensureQueryData(catalogQuery),
  component: Home,
});

type Category = "hypertv" | "trex";

type PlanCardData = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number | null;
};

function PlanCard({ plan, trex, details }: { plan: PlanCardData; trex: boolean; details: ReactNode }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/60 hover:shadow-glow">
      {plan.cover_url && <img src={plan.cover_url} alt={plan.name} loading="lazy" suppressHydrationWarning className="aspect-video w-full object-cover" />}
      <div className="flex flex-1 flex-col p-6">
        <h2 className="text-xl font-bold">{plan.name}</h2>
        {plan.description && <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>}
        <p className="mt-4 text-3xl font-extrabold">{plan.price_cents !== null ? formatPrice(plan.price_cents) : <span className="text-base font-medium text-muted-foreground">Prix bientôt disponible</span>}</p>
        {details}
        <div className="mt-auto pt-6">
          {plan.price_cents !== null ? (
            <Button asChild variant="hero" className="w-full">
              <Link to="/commander/$planId" params={{ planId: plan.id }} {...(trex ? { search: { type: "trex" } } : {})}>Acheter</Link>
            </Button>
          ) : <Button variant="secondary" className="w-full" disabled>Bientôt disponible</Button>}
        </div>
      </div>
    </article>
  );
}

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);
  const shop = data.shop;
  const shopName = shop.name ?? null;
  const [category, setCategory] = useState<Category | null>(null);
  useEffect(() => {
    const reset = () => { setCategory(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
    window.addEventListener("shop:home", reset);
    return () => window.removeEventListener("shop:home", reset);
  }, []);
  const categories: { id: Category; label: string; description: string; image: string | null; icon: typeof Tv; count: number }[] = [
    {
      id: "hypertv",
      label: "HYPER TV",
      description: "Abonnements pour activer votre application HYPERTV.",
      image: data.plans[0]?.cover_url ?? null,
      icon: Tv,
      count: data.plans.length,
    },
    {
      id: "trex",
      label: "TREX",
      description: "Lignes M3U prêtes automatiquement sur votre application ou à télécharger.",
      image: data.trexPlans[0]?.cover_url ?? null,
      icon: ListMusic,
      count: data.trexPlans.length,
    },
  ];
  return (
    <div className="min-h-screen bg-gradient-hero">
      <SiteHeader name={shopName} logoUrl={shop.logoUrl} />
      <main className="mx-auto max-w-6xl px-4 pb-20">
        {category === null ? (
        <section className="py-10 text-center md:py-16">
          <h1 className={`mx-auto max-w-2xl font-bold leading-tight tracking-tight text-balance ${category === null ? "text-2xl sm:text-3xl md:text-4xl" : "text-xl md:text-2xl"}`}>
            {shop.description ?? <>Votre abonnement {shopName && <span className="text-primary">{shopName}</span>}, prêt en quelques secondes</>}
          </h1>
          {category === null && (
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground md:text-base">
              {shop.slogan ?? "Choisissez une catégorie, saisissez l'adresse MAC de votre appareil, c'est tout."}
            </p>
          )}
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" /> Activation automatique après paiement
          </p>
        </section>
        ) : (
          <div className="pt-6" />
        )}

        {data.error && <p className="text-center text-destructive">{data.error}</p>}
        {!data.error && data.plans.length === 0 && data.trexPlans.length === 0 && (
          <p className="text-center text-muted-foreground">Aucune formule disponible pour le moment.</p>
        )}

        {!data.error && (data.plans.length > 0 || data.trexPlans.length > 0) && category === null && (
          <section aria-label="Choisissez une catégorie" className="grid gap-5 sm:grid-cols-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className="group flex items-center gap-5 rounded-2xl border border-border bg-card p-6 text-left transition hover:border-primary/60 hover:shadow-glow"
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-primary shadow-glow">
                  {c.image ? (
                    <img src={c.image} alt="" loading="lazy" suppressHydrationWarning className="h-full w-full object-cover" />
                  ) : (
                    <c.icon className="h-7 w-7 text-primary-foreground" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="block text-xl font-bold">{c.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{c.description}</span>
                  <span className="mt-2 block text-xs font-medium text-primary">
                    {c.count > 0 ? `${c.count} formule${c.count > 1 ? "s" : ""} disponible${c.count > 1 ? "s" : ""}` : "Bientôt disponible"}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </button>
            ))}
          </section>
        )}

        {!data.error && category !== null && (
          <section aria-label={category === "hypertv" ? "HYPER TV" : "TREX"}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <Button variant="ghost" size="sm" onClick={() => setCategory(null)}>
                <ArrowLeft className="h-4 w-4" /> Toutes les catégories
              </Button>
            </div>
            {categories.find((c) => c.id === category)?.count === 0 ? (
              <p className="text-center text-muted-foreground">Aucune formule disponible dans cette catégorie pour le moment.</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {category === "hypertv"
                  ? data.plans.map((p) => (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        trex={false}
                        details={
                          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {p.duration_days} jours</li>
                            <li className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-primary" /> {p.max_devices} écran{p.max_devices > 1 ? "s" : ""}</li>
                            {p.features.map((f) => <li key={f} className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> {f}</li>)}
                          </ul>
                        }
                      />
                    ))
                  : data.trexPlans.map((p) => (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        trex
                        details={
                          <div className="mt-5 space-y-2">
                            <ul className="space-y-2 text-xs">
                              {trexLineLabels(p.line).map((lbl, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CircleCheck className="mt-px h-4 w-4 shrink-0 text-primary" />
                                  <span className="min-w-0 break-words">{lbl}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                        }
                      />
                    ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
