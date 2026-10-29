import { createFileRoute } from "@tanstack/react-router";

// Relaie le flux SSE HyperTV (événements sans contenu) pour le client connecté.
export const Route = createFileRoute("/api/support-stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = { "Cache-Control": "no-store" };
        const { readSession } = await import("@/lib/account.server");
        const session = readSession();
        if (!session) return new Response(null, { status: 401, headers });
        const { openSupportStream } = await import("@/lib/hypertvClient.server");
        let up: Response;
        try {
          up = await openSupportStream(session, request.signal);
        } catch {
          return new Response(null, { status: 502, headers });
        }
        if (!up.ok || !up.body) return new Response(null, { status: up.status === 401 ? 401 : 502, headers });
        return new Response(up.body, {
          headers: { ...headers, "Content-Type": "text/event-stream", Connection: "keep-alive", "X-Accel-Buffering": "no" },
        });
      },
    },
  },
});
