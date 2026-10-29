import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { appsQuery } from "@/lib/apps.functions";
import { getShopInfo } from "@/lib/shop.functions";
import { DownloadApps } from "@/components/DownloadApps";
import { GuidesShell, GuidesNotFound, GuidesError } from "@/components/GuidesShell";

const shopQuery = queryOptions({ queryKey: ["shop-info"], queryFn: () => getShopInfo(), staleTime: 300_000 });

export const Route = createFileRoute("/telecharger")({
  loader: async ({ context }) => {
    const [apps, shop] = await Promise.all([
      context.queryClient.ensureQueryData(appsQuery),
      context.queryClient.ensureQueryData(shopQuery),
    ]);
    if (!apps) throw notFound();
    return { shopName: shop?.name ?? null };
  },
  head: ({ loaderData }) => {
    const brand = loaderData?.shopName ?? "Boutique";
    const title = `Télécharger HyperTV — ${brand}`;
    const description = "Téléchargez la dernière version de l'application HyperTV pour Android, Windows, macOS et Smart TV.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: DownloadPage,
  errorComponent: GuidesError,
  notFoundComponent: () => <GuidesNotFound label="Téléchargements indisponibles" />,
});

function DownloadPage() {
  const { data: apps } = useSuspenseQuery(appsQuery);
  const { data: shop } = useSuspenseQuery(shopQuery);
  return (
    <GuidesShell shop={shop}>
      {apps ? <DownloadApps data={apps} /> : null}
    </GuidesShell>
  );
}
