import { createFileRoute } from "@tanstack/react-router";
import { getCatalog } from "@/lib/shop.functions";
type Catalog = Awaited<ReturnType<typeof getCatalog>>;
export const Route = createFileRoute("/__diag")({
  head: ({ loaderData }) => {
    const s = loaderData;
    return { meta: [{ title: String(s) }] };
  },
  loader: ({ context }): Promise<Catalog> => context.queryClient.ensureQueryData({ queryKey: ["catalog"], queryFn: () => getCatalog() }),
  component: () => <div>diag</div>,
});
