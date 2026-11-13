import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, CircleCheck, Clock, Crown, ListMusic, MonitorSmartphone, RotateCw, Truck, Tv, Zap } from "lucide-react";
import { getCatalog } from "@/lib/shop.functions";
import { trexLineLabels, plansForProvider } from "@/lib/shop-offers";
import { formatPrice } from "@/lib/hypertv-shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DownloadApps } from "@/components/DownloadApps";
import { appsQuery } from "@/lib/apps.functions";
import { Button } from "@/components/ui/button";

// Les URL d'images de l'API expirent après 24 h : on relit le catalogue à chaque visite.
const catalogQuery = queryOptions({
  queryKey: ["catalog", "providers-v2"],
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
  loader: async ({ context }): Promise<Catalog> => {
    const [catalog] = await Promise.all([context.queryClient.fetchQuery(catalogQuery), context.queryClient.ensureQueryData(appsQuery)]);
    return catalog;
  },
  component: Home,
});

type Category = "hypertv" | "trex" | "8kpro" | "lion" | "hypervod";

type PlanCardData = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number | null;
};

function PlanCard({ plan, type, details }: { plan: PlanCardData; type?: "trex" | "lion" | "hypervod"; details: ReactNode }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/60 hover:shadow-glow">
      {plan.cover_url && <img src={plan.cover_url} alt={plan.name} loading="lazy" suppressHydrationWarning className="aspect-video w-full object-cover" />}
      <div className="flex flex-1 flex-col p-6">
        <h2 className="text-xl font-bold">{plan.name}</h2>
        {plan.description && <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>}
        <p className="mt-4 text-3xl font-extrabold">{plan.price_cents !== null ? (plan.price_cents === 0 && type === "hypervod" ? "Gratuit" : formatPrice(plan.price_cents)) : <span className="text-base font-medium text-muted-foreground">Prix bientôt disponible</span>}</p>
        {details}
        <div className="mt-auto pt-6">
          {plan.price_cents !== null ? (
            <Button asChild variant="hero" className="w-full">
              <Link to="/commander/$planId" params={{ planId: plan.id }} {...(type ? { search: { type } } : {})}>Acheter</Link>
            </Button>
          ) : <Button variant="secondary" className="w-full" disabled>Bientôt disponible</Button>}
        </div>
      </div>
    </article>
  );
}

function Home() {
  const { data, refetch, isFetching } = useSuspenseQuery(catalogQuery);
  const { data: apps } = useSuspenseQuery(appsQuery);
  const shop = data.shop;
  const shopName = shop.name ?? null;
  const trexPlans = plansForProvider(data.trexPlans, "trex");
  const proPlans = plansForProvider(data.trexPlans, "8kpro");
  const [category, setCategory] = useState<Category | null>(null);
  useLayoutEffect(() => {
    if (category === null) return;
    // Reset after React replaces the category tiles with the product listing.
    // A smooth scroll started before that replacement can be cancelled by iOS
    // scroll anchoring, retaining the previous page's offset instead.
    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [category]);
  useEffect(() => {
    const reset = () => { setCategory(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
    const goDownload = () => {
      setCategory(null);
      // Laisse le temps au bloc de se réafficher si une catégorie était ouverte.
      setTimeout(() => document.getElementById("telechargements")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    };
    window.addEventListener("shop:home", reset);
    window.addEventListener("shop:download", goDownload);
    return () => {
      window.removeEventListener("shop:home", reset);
      window.removeEventListener("shop:download", goDownload);
    };
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
      id: "hypervod",
      label: "HYPER VOD",
      description: "Films & séries sur votre application HyperTV.",
      image: data.hypervodPlans[0]?.cover_url ?? null,
      icon: Tv,
      count: data.hypervodPlans.length,
    },
    {
      id: "trex",
      label: "Abonnements TREX OTT",
      description: "Lignes M3U prêtes automatiquement sur votre application ou à télécharger.",
      image: trexPlans[0]?.cover_url ?? null,
      icon: ListMusic,
      count: trexPlans.length,
    },
    {
      id: "8kpro",
      label: "Abonnements STRONG 8K",
      description: "Lignes M3U prêtes automatiquement sur votre application ou à télécharger.",
      image: proPlans[0]?.cover_url ?? null,
      icon: ListMusic,
      count: proPlans.length,
    },
    {
      id: "hypervod",
      label: "HYPER VOD",
      description: "Films & séries sur votre application HyperTV.",
      image: data.hypervodPlans[0]?.cover_url ?? null,
      icon: Tv,
      count: data.hypervodPlans.length,
    },
    {
      id: "lion",
      label: "LION OTT",
      description: "Abonnements livrés manuellement par ticket-support après votre achat.",
      image: data.lionPlans[0]?.cover_url ?? null,
      icon: Crown,
      count: data.lionPlans.length,
    },
  ];
  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero">
      <SiteHeader name={shopName} logoUrl={shop.logoUrl} guidesEnabled={shop.guidesEnabled} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20">
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

        {data.error && <div role="alert" className="space-y-3 text-center"><p className="text-destructive">{data.error}</p><Button variant="outline" disabled={isFetching} onClick={() => void refetch()}><RotateCw className="h-4 w-4" /> Réessayer</Button></div>}
        {!data.error && data.plans.length === 0 && data.trexPlans.length === 0 && data.lionPlans.length === 0 && data.hypervodPlans.length === 0 && (
          <p className="text-center text-muted-foreground">Aucune formule disponible pour le moment.</p>
        )}

        {!data.error && (data.plans.length > 0 || data.trexPlans.length > 0 || data.lionPlans.length > 0 || data.hypervodPlans.length > 0) && category === null && (
          <section aria-label="Choisissez une catégorie" className="grid gap-5 sm:grid-cols-2">
            {categories.filter(c => !["trex", "8kpro", "hypervod"].includes(c.id) || c.count > 0).map((c) => (
              <Button
                variant="ghost"
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className="group flex h-auto items-center gap-5 whitespace-normal rounded-2xl border border-border bg-card p-6 text-left transition hover:border-primary/60 hover:shadow-glow"
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
              </Button>
            ))}
          </section>
        )}

        {!data.error && category !== null && (
          <section aria-label={categories.find(c => c.id === category)?.label}>
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
                        details={
                          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {p.duration_days} jours</li>
                            <li className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-primary" /> {p.max_devices} écran{p.max_devices > 1 ? "s" : ""}</li>
                            {p.features.map((f) => <li key={f} className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> {f}</li>)}
                          </ul>
                        }
                      />
                    ))
                  : category === "hypervod"
                    ? data.hypervodPlans.map(p => <PlanCard key={p.id} plan={p} type="hypervod" details={
                      <ul className="mt-5 space-y-2 text-xs">
                        <li className="flex items-start gap-2"><Clock className="h-4 w-4 shrink-0 text-primary" /><span>{p.line.isDemo ? "Démo 24 h" : `${p.line.months} mois`}</span></li>
                        {trexLineLabels(p.line).map((label, i) => <li key={i} className="flex items-start gap-2"><CircleCheck className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 break-words">{label}</span></li>)}
                        <li className="flex items-start gap-2"><MonitorSmartphone className="h-4 w-4 shrink-0 text-primary" /><span>{p.line.screens} écran{p.line.screens > 1 ? "s" : ""}</span></li>
                        {p.includesHypertvSubscription && <li className="flex items-start gap-2"><Zap className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 break-words">+ HYPER {p.includesHypertvSubscription.name} ({p.includesHypertvSubscription.durationDays} j, {p.includesHypertvSubscription.maxDevices} écran{p.includesHypertvSubscription.maxDevices > 1 ? "s" : ""})</span></li>}
                      </ul>
                    } />)
                  : category === "lion"
                    ? data.lionPlans.map((p) => (
                        <PlanCard
                          key={p.id}
                          plan={p}
                          type="lion"
                          details={
                            <ul className="mt-5 space-y-2 text-xs">
                              <li className="flex items-start gap-2">
                                <Clock className="mt-px h-4 w-4 shrink-0 text-primary" />
                                <span>{p.line.isDemo ? "Démo" : `${p.line.months} mois`}</span>
                              </li>
                              {trexLineLabels(p.line).map((lbl, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CircleCheck className="mt-px h-4 w-4 shrink-0 text-primary" />
                                  <span className="min-w-0 break-words">{lbl}</span>
                                </li>
                              ))}
                              {p.includesHypertvSubscription && (
                                <li className="flex items-start gap-2">
                                  <Zap className="mt-px h-4 w-4 shrink-0 text-primary" />
                                  <span className="min-w-0 break-words">+ HYPER {p.includesHypertvSubscription.name} ({p.includesHypertvSubscription.durationDays} j, {p.includesHypertvSubscription.maxDevices} écran{p.includesHypertvSubscription.maxDevices > 1 ? "s" : ""})</span>
                                </li>
                              )}
                              <li>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                  <Truck className="h-3.5 w-3.5" /> Livraison par votre revendeur
                                </span>
                              </li>
                            </ul>
                          }
                        />
                      ))
                  : (category === "8kpro" ? proPlans : trexPlans).map((p) => (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        type="trex"
                        details={
                          <ul className="mt-5 space-y-2 text-xs">
                            <li className="flex items-start gap-2"><Clock className="h-4 w-4 shrink-0 text-primary" /><span>{p.line.isDemo || p.price_cents === 0 ? "Démo" : `${p.line.months} mois`}</span></li>
                            {trexLineLabels(p.line).map((lbl, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <CircleCheck className="mt-px h-4 w-4 shrink-0 text-primary" />
                                <span className="min-w-0 break-words">{lbl}</span>
                              </li>
                            ))}
                            {p.includesHypertvSubscription && <li className="flex items-start gap-2"><Zap className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 break-words">+ HYPER {p.includesHypertvSubscription.name} ({p.includesHypertvSubscription.durationDays} j, {p.includesHypertvSubscription.maxDevices} écran{p.includesHypertvSubscription.maxDevices > 1 ? "s" : ""})</span></li>}
                          </ul>
                        }
                      />
                    ))}
              </div>
            )}
          </section>
        )}
        {category === null && apps && (
          <div id="telechargements" className="mt-12 scroll-mt-24">
            <DownloadApps data={apps} />
          </div>
        )}
      </main>
      <SiteFooter name={shopName} slogan={shop.slogan} />
    </div>
  );
}
