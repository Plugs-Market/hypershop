import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getGuideDetail } from "@/lib/guides.functions";
import { formatGuideDate } from "@/lib/guides";
import { GuidesShell, GuidesNotFound, GuidesError, BackToGuides } from "@/components/GuidesShell";

const guideQuery = (slug: string) =>
  queryOptions({
    queryKey: ["guide", slug],
    queryFn: () => getGuideDetail({ data: { slug } }),
    staleTime: 300_000,
  });

export const Route = createFileRoute("/guides/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(guideQuery(params.slug)),
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Guide indisponible" }, { name: "robots", content: "noindex" }] };
    const { guide, shop } = loaderData;
    const title = `${guide.title} — ${shop.name ?? "Guides"}`;
    const description = guide.excerpt ?? `Guide ${guide.title}`;
    const url = `https://shop.hypertv.win/guides/${params.slug}`;
    const img = guide.coverUrl?.startsWith("https://") ? guide.coverUrl : null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: GuidePage,
  errorComponent: GuidesError,
  notFoundComponent: () => <GuidesNotFound />,
});

function GuidePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(guideQuery(slug));
  const g = data.guide;
  const published = formatGuideDate(g.publishedAt);
  const updated = formatGuideDate(g.updatedAt);
  return (
    <GuidesShell shop={data.shop}>
      <article className="mx-auto max-w-3xl">
        <BackToGuides />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {g.category && <span className="rounded-full border border-border px-2 py-0.5">{g.category.name}</span>}
          {published && <span className="text-muted-foreground">Publié le {published}</span>}
          {updated && updated !== published && <span className="text-muted-foreground">· mis à jour le {updated}</span>}
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold md:text-4xl">{g.title}</h1>
        {g.coverUrl && (
          <img src={g.coverUrl} alt="" suppressHydrationWarning className="mt-6 aspect-video w-full rounded-2xl object-cover" />
        )}
        <div className="mt-8 space-y-4 leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:font-semibold [&_img]:rounded-xl [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-4 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-6">
          {/* Pas de rehype-raw : le HTML brut du Markdown est ignoré. */}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {g.contentMd ?? ""}
          </ReactMarkdown>
        </div>
        <div className="mt-10 border-t border-border/60 pt-6">
          <BackToGuides />
        </div>
      </article>
    </GuidesShell>
  );
}
