import { createFileRoute } from "@tanstack/react-router";
import { downloadPlaylist } from "@/lib/shop.functions";

export const Route = createFileRoute("/api/public/orders/$id/playlist")({
  server: { handlers: { GET: ({ params }) => downloadPlaylist(params.id) } },
});