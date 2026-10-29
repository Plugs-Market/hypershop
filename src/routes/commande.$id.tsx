import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { getShopInfo, getOrder, retryActivation } from "@/lib/shop.functions";
import { formatPrice } from "@/lib/hypertv-shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/commande/$id")({
  head: ({ loaderData }) => {
    const shopName = loaderData?.shop?.name ?? "Boutique";
    return {
      meta: [
        { title: `Suivi de commande — ${shopName}` },
        { name: "description", content: "Suivez le paiement et l'activation de votre abonnement." },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: `Suivi de commande — ${shopName}` },
        { property: "og:description", content: "Suivi de votre commande." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  loader: async ({ params }): Promise<{
    order: Awaited<ReturnType<typeof getOrder>>;
    shop: Awaited<ReturnType<typeof getShopInfo>>;
  }> => {
    const [order, shop] = await Promise.all([
      getOrder({ data: { id: params.id } }),
      getShopInfo(),
    ]);
    return { order, shop };
  },
  component: OrderPage,
});

type Order = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

function OrderPage() {
  const { order: initial, shop } = Route.useLoaderData();
  const [order, setOrder] = useState<Order | null>(initial);
  const [busy, setBusy] = useState(false);
  const retry = useServerFn(retryActivation);
  const tried = useRef(false);

  async function doRetry() {
    if (!order) return;
    setBusy(true);
    try { setOrder(await retry({ data: { id: order.id } })); } finally { setBusy(false); }
  }

  // Nouvel essai automatique (même clé d'idempotence) si l'activation est en attente.
  useEffect(() => {
    if (!order || tried.current) return;
    if (order.payment_status === "paid" && (order.activation_status === "pending_retry" || order.activation_status === "pending")) {
      tried.current = true;
      const t = setTimeout(doRetry, 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) {
    return (<div className="min-h-screen"><SiteHeader name={shop?.name} /><p className="p-12 text-center text-muted-foreground">Commande introuvable.</p></div>);
  }

  const activated = order.activation_status === "activated";
  const failed = order.activation_status === "failed";
  const waiting = order.payment_status === "paid" && !activated && !failed;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <SiteHeader name={shop?.name} />
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-3xl font-bold">Suivi de commande</h1>
        <div className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            {activated ? <CheckCircle2 className="h-8 w-8 text-success" /> : failed ? <XCircle className="h-8 w-8 text-destructive" /> : waiting ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Clock className="h-8 w-8 text-warning" />}
            <div>
              <p className="font-semibold">
                {activated ? "Abonnement activé" : failed ? "Activation impossible" : waiting ? "Activation en cours…" : "En attente de paiement"}
              </p>
              {activated && order.expires_at && (
                <p className="text-sm text-muted-foreground">Valable jusqu'au <strong className="text-foreground">{new Date(order.expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong></p>
              )}
            </div>
          </div>
          {order.activation_error && !activated && <p className="rounded-lg bg-muted p-3 text-sm">{order.activation_error}</p>}

          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Formule</dt><dd className="text-right">{order.plan_name}</dd>
            <dt className="text-muted-foreground">Prix</dt><dd className="text-right">{formatPrice(order.price_cents)}</dd>
            <dt className="text-muted-foreground">Appareil (MAC)</dt><dd className="text-right font-mono">{order.mac}</dd>
            <dt className="text-muted-foreground">Email</dt><dd className="truncate text-right">{order.email}</dd>
          </dl>

          {order.payment_status === "pending" && (
            <div className="space-y-2 border-t border-border pt-5">
              {/* Emplacement du paiement Stripe (à brancher plus tard). */}
              <Button className="w-full" variant="hero" disabled>Payer (bientôt disponible)</Button>
            </div>
          )}
          {waiting && <Button className="w-full" variant="outline" onClick={doRetry} disabled={busy}>Réessayer l'activation</Button>}

          <Button variant="ghost" size="sm" className="w-full" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Lien copié"); }}>
            <Copy className="h-4 w-4" /> Copier le lien de suivi
          </Button>
        </div>
      </main>
    </div>
  );
}
