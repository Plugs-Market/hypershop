import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async () => {
        const { hypertv } = await import("@/lib/hypertvClient.server");
        let name = "Boutique";
        let description = "Abonnements activés automatiquement après paiement.";
        try {
          const shop = await hypertv.getShop();
          if (shop?.name) name = shop.name;
          if (shop?.slogan) description = shop.slogan;
        } catch {
          // valeurs par défaut
        }
        const manifest = {
          id: "/",
          name,
          short_name: name.slice(0, 12),
          description,
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#1a1214",
          theme_color: "#1a1214",
          lang: "fr",
          icons: [
            { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        };
        return new Response(JSON.stringify(manifest), {
          headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
