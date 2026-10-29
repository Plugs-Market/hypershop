import { createFileRoute } from "@tanstack/react-router";

const MAX_ICON_BYTES = 2 * 1024 * 1024;

function fallback(request: Request) {
  return Response.redirect(new URL("/icon-default.png", request.url).toString(), 302);
}

export const Route = createFileRoute("/app-icon/$size")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { hypertv } = await import("@/lib/hypertvClient.server");
          const shop = await hypertv.getShop();
          const raw = shop?.logoUrl;
          if (!raw) return fallback(request);
          const url = new URL(raw);
          if (url.protocol !== "https:") return fallback(request);
          const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
          const type = res.headers.get("content-type") ?? "";
          if (!res.ok || !type.startsWith("image/")) return fallback(request);
          const body = await res.arrayBuffer();
          if (body.byteLength > MAX_ICON_BYTES) return fallback(request);
          return new Response(body, {
            headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
          });
        } catch {
          return fallback(request);
        }
      },
    },
  },
});
