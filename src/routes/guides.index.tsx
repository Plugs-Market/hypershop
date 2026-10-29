import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Star } from "lucide-react";
import { getGuidesIndex } from "@/lib/guides.functions";
import { formatGuideDate } from "@/lib/guides";
import { GuidesShell, GuidesNotFound, GuidesError } from "@/components/GuidesShell";

const guidesQuery = (category?: string) =>
  queryOptions({
    queryKey: ["guides", category ?? ""],
    queryFn: () => getGuidesIndex({ data: { category } }),
    staleTime: 300_000,
  });

export const Route = createFileRoute("/guides/")({
  validateSearch: z.object({ category: z.string().optional() }),
  loaderDeps: ({ search }) => ({ category: search.category }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(guidesQuery(deps.category)),
  head: ({ loaderData }) => {
    const brand = loaderData?.shop.name ?? "Boutique";
    const title = `Guides — ${brand}`;
    const description = `Tutoriels et guides pour installer et profiter de votre abonnement ${brand}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: "https://shop.hypertv.win/guides" }],
    };
  },
  component: GuidesPage,
  errorComponent: GuidesError,
  notFoundComponent: () => <GuidesNotFound label="Guides indisponibles" />,
});

function GuidesPage() {
  const { category } = Route.useSearch();
  const { data } = useSuspenseQuery(guidesQuery(category));
  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm transition-colors ${
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/60 hover:border-primary/60"
    }`;
  return (
    <GuidesShell shop={data.shop}>
      <h1 className="font-display text-2xl font-bold md:text-3xl">Guides</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/guides" search={{}} className={chip(!category)}>Tous</Link>
        {data.categories.map((c) => (
          <Link key={c.id} to="/guides" search={{ category: c.slug }} className={chip(category === c.slug)}>
            {c.name}
          </Link>
        ))}
      </div>
      {data.guides.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Aucun guide dans cette catégorie pour le moment.</p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.guides.map((g) => (
            <Link
              key={g.slug}
              to="/guides/$slug"
              params={{ slug: g.slug }}
              className="group overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/60"
            >
              {g.coverUrl ? (
                <img src={g.coverUrl} alt="" loading="lazy" suppressHydrationWarning className="aspect-video w-full object-cover" />
              ) : (
                <div className="aspect-video w-full bg-gradient-primary opacity-40" />
              )}
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {g.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                      <Star className="h-3 w-3" /> À la une
                    </span>
                  )}
                  {g.category && <span className="rounded-full border border-border px-2 py-0.5">{g.category.name}</span>}
                  {formatGuideDate(g.publishedAt) && (
                    <span className="text-muted-foreground">{formatGuideDate(g.publishedAt)}</span>
                  )}
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold group-hover:text-primary">{g.title}</h2>
                {g.excerpt && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{g.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </GuidesShell>
  );
}
