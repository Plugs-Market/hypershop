import { Link } from "@tanstack/react-router";
import { LifeBuoy, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import type { OrderProgress } from "@/lib/shop-order";
import { isOrderDelivered } from "@/lib/order-ticket";

export function OrderTicketPanel({ order, opening = false }: { order: OrderProgress; opening?: boolean }) {
  const manual = order.type === "lion" || !!order.manualDeliveryStatus;
  const trexFailed = order.type === "trex" && order.state === "paid_activation_failed";
  const delivered = isOrderDelivered(order);
  if (delivered && !order.supportTicketId && !manual) return null;
  if (!order.supportTicketId && !order.supportTicketRequired && !trexFailed && (!manual || order.manualDeliveryStatus === "awaiting_payment" || order.state === "pending")) return null;
  const status = delivered ? "Livré" : order.supportTicketId || order.manualDeliveryStatus === "awaiting_reseller" ? "En cours de préparation" : "Ouverture du ticket";
  return <section className="space-y-3 border-t border-border pt-4">
    {manual && <p className="font-semibold">{status}</p>}
    {manual && !delivered && <p className="text-sm text-muted-foreground">Votre abonnement vous sera fourni par le vendeur dans le ticket support.</p>}
    {trexFailed && <p className="text-sm text-muted-foreground">Votre ligne n'a pas pu être livrée automatiquement. Le vendeur va vous la fournir dans le ticket support.</p>}
    {opening && !delivered && !order.supportTicketId && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin text-primary" />Ouverture de votre ticket support…</p>}
    {order.supportTicketId && <Button variant="hero" asChild className="w-full"><Link to="/mon-compte/support/$id" params={{ id: order.supportTicketId }}><LifeBuoy className="h-4 w-4" />Ouvrir le ticket support</Link></Button>}
    {order.supportTicketRequired && !delivered && !opening && !order.supportTicketId && <Button variant="outline" asChild className="w-full"><Link to="/connexion">Me connecter pour recevoir ma livraison</Link></Button>}
  </section>;
}