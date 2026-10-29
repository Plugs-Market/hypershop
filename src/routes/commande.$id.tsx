import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, XCircle, Copy, Rocket, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { getShopInfo, getOrder, getPaymentMethods, stripeCheckout, paypalTxid } from "@/lib/shop.functions";
import type { ShopOrder, PaymentMethod } from "@/lib/hypertvClient.server";
import { formatEur } from "@/lib/hypertv-shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activationNotice, shouldPollOrder, trexTimeline } from "@/lib/shop-order";
import { queryOptions } from "@tanstack/react-query";
import { getCatalog } from "@/lib/shop.functions";
import { OrderDelivery } from "@/components/OrderDelivery";

export const Route = createFileRoute("/commande/$id")({
  head: ({ loaderData }) => {
    const data = loaderData as { shop?: { name?: string | null } } | undefined;
    const shopName = data?.shop?.name ?? "Boutique";
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
  loader: async ({ params, context }): Promise<{
    order: Awaited<ReturnType<typeof getOrder>>;
    shop: Awaited<ReturnType<typeof getShopInfo>>;
    methods: Awaited<ReturnType<typeof getPaymentMethods>>;
    includedSubscription: ShopOrder["includesHypertvSubscription"];
  }> => {
    const [order, shop, methods] = await Promise.all([
      getOrder({ data: { id: params.id } }),
      getShopInfo(),
      getPaymentMethods(),
    ]);
    let includedSubscription = order?.includesHypertvSubscription;
    if (order?.type === "trex" && includedSubscription === undefined) {
      const catalog = await context.queryClient.ensureQueryData(queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog(), staleTime: 0 }));
      includedSubscription = catalog.trexPlans.find((plan) => plan.id === order.trexPlanId)?.includesHypertvSubscription;
    }
    return { order, shop, methods, includedSubscription };
  },
  component: OrderPage,
});

type Order = ShopOrder;

// États qui évoluent encore : on relance le suivi toutes les 20 s.
const CRYPTO_METHODS = new Set(["btc", "eth", "ltc", "ton"]);

function OrderPage() {
  const { order: initial, shop, methods, includedSubscription } = Route.useLoaderData() as {
    order: Order | null;
    shop: { name: string | null; slogan?: string | null; logoUrl: string | null };
    methods: { methods: PaymentMethod[]; error: string | null };
    includedSubscription: Order["includesHypertvSubscription"];
  };
  const [order, setOrder] = useState<Order | null>(initial);
  const fetchOrder = useServerFn(getOrder);

  async function refresh() {
    if (!order) return;
    try {
      const fresh = await fetchOrder({ data: { id: order.id } });
      if (fresh) setOrder(fresh as Order);
    } catch {
      // Erreur réseau temporaire : le prochain cycle de polling réessaiera.
    }
  }

  // Polling toutes les 20 s tant que la commande évolue encore.
  useEffect(() => {
    if (!order || !shouldPollOrder(order)) return;
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) {
    return (<div className="flex min-h-screen flex-col"><SiteHeader name={shop?.name ?? null} logoUrl={shop?.logoUrl ?? null} /><p className="p-12 text-center text-muted-foreground">Commande introuvable.</p><SiteFooter name={shop?.name ?? null} slogan={shop?.slogan ?? null} /></div>);
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <SiteHeader name={shop?.name} logoUrl={shop?.logoUrl} />
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-3xl font-bold">Suivi de commande</h1>
        <div className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6">
          <StateBadge order={order} />
          {order.type === "trex" && <TrexTimeline order={{ ...order, includesHypertvSubscription: order.includesHypertvSubscription ?? includedSubscription ?? null }} />}

          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Formule</dt><dd className="text-right">{order.plan}</dd>
            <dt className="text-muted-foreground">Prix</dt><dd className="text-right">{formatEur(order.priceEur)}</dd>
            <dt className="text-muted-foreground">Appareil (MAC)</dt><dd className="text-right font-mono">{order.mac}</dd>
            {order.email && <><dt className="text-muted-foreground">Email</dt><dd className="truncate text-right">{order.email}</dd></>}
            {order.payment?.label && (
              <>
                <dt className="text-muted-foreground">Paiement</dt><dd className="text-right">{order.payment.label}</dd>
              </>
            )}
          </dl>

          {order.state === "activated" && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="flex items-center justify-center gap-2 text-center font-semibold">
                <Rocket className="h-5 w-5 shrink-0 text-primary" />
                {order.type === "trex" ? "Votre playlist a été ajoutée automatiquement à votre application HyperTV. Ouvrez l'app pour en profiter." : "Lancez votre application pour profiter de votre abonnement"}
              </p>
              {order.type !== "trex" && <p className="mt-2 text-center text-sm text-muted-foreground">
                Redémarrez l'application HyperTV sur votre appareil : votre formule est déjà active.
              </p>}
            </div>
          )}
          {order.type === "trex" && order.state === "activated" && <OrderDelivery key={order.id} id={order.id} authorized={order.deliveryAuthorized === true} />}
          {order.state === "expired" && (order.trexPlanId || order.planId) && (
            <Button asChild variant="hero" className="w-full">
              <Link to="/commander/$planId" params={{ planId: order.trexPlanId ?? order.planId ?? "" }} search={order.type === "trex" ? { type: "trex" } : {}}>
                <RotateCcw className="h-4 w-4" /> Recommencer
              </Link>
            </Button>
          )}

          {order.state === "pending" && order.payment && (
            <PaymentPanel order={order} methods={methods.methods} onReload={refresh} />
          )}

          <Button variant="ghost" size="sm" className="w-full" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Lien copié"); }}>
            <Copy className="h-4 w-4" /> Copier le lien de suivi
          </Button>
        </div>
      </main>
      <SiteFooter name={shop?.name ?? null} slogan={shop?.slogan ?? null} />
    </div>
  );
}

function StateBadge({ order }: { order: Order }) {
  const base = "flex items-center gap-3";
  const notice = activationNotice(order);
  if (notice) return <div className={base}><Clock className="h-8 w-8 shrink-0 text-warning" /><p className="font-semibold">{notice}</p></div>;
  switch (order.state) {
    case "pending":
      return (
        <div className={base}>
          <Clock className="h-8 w-8 shrink-0 text-warning" />
          <div>
            <p className="font-semibold">En attente de paiement</p>
            {order.expiresAt && <Countdown expiresAt={order.expiresAt} />}
          </div>
        </div>
      );
    case "detected":
      return (
        <div className={base}>
          <Loader2 className="h-8 w-8 shrink-0 animate-spin text-primary" />
          <p className="font-semibold">Paiement détecté, confirmation en cours…</p>
        </div>
      );
    case "review":
      return (
        <div className={base}>
          <ShieldCheck className="h-8 w-8 shrink-0 text-primary" />
          <p className="font-semibold">Paiement en cours de vérification</p>
        </div>
      );
    case "paid":
      return (
        <div className={base}>
          <Loader2 className="h-8 w-8 shrink-0 animate-spin text-primary" />
          <p className="font-semibold">Payé, activation en cours…</p>
        </div>
      );
    case "activated":
      return (
        <div className={base}>
          <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />
          <div>
            <p className="font-semibold">{order.type === "trex" ? "Playlist activée" : "Abonnement activé ✅"}</p>
            {order.subscriptionExpiresAt && (
              <p className="text-sm text-muted-foreground">
                {order.type === "trex" ? "Application HyperTV valable jusqu'au " : "Valable jusqu'au "}<strong className="text-foreground">{new Date(order.subscriptionExpiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong>
              </p>
            )}
          </div>
        </div>
      );
    case "expired":
      return (
        <div className={base}>
          <XCircle className="h-8 w-8 shrink-0 text-destructive" />
          <p className="font-semibold">Commande expirée</p>
        </div>
      );
    case "cancelled":
      return (
        <div className={base}>
          <XCircle className="h-8 w-8 shrink-0 text-destructive" />
          <p className="font-semibold">Commande annulée</p>
        </div>
      );
    default:
      return (
        <div className={base}>
          <Clock className="h-8 w-8 shrink-0 text-muted-foreground" />
          <p className="font-semibold">Traitement de votre commande en cours</p>
        </div>
      );
  }
}

function TrexTimeline({ order }: { order: Order }) {
  const steps = trexTimeline(order);
  const current = steps.findIndex((step) => !step.done);
  return <ol aria-label="Progression de l'activation TREX" className="space-y-4 border-t border-border pt-5">
    {steps.map((step, index) => <li key={step.label} className="flex items-center gap-3 text-sm" aria-current={index === current ? "step" : undefined}>
      {step.done ? <CheckCircle2 aria-label="Terminé" className="h-5 w-5 shrink-0 text-success" /> : <Clock aria-label={index === current ? "En cours" : "En attente"} className={`h-5 w-5 shrink-0 ${index === current ? "text-primary" : "text-muted-foreground"}`} />}
      <span className={step.done || index === current ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
    </li>)}
  </ol>;
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const text = h > 0
    ? `${h} h ${String(m).padStart(2, "0")} min`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return (
    <p className="text-sm text-muted-foreground">
      Expire dans <strong className="font-mono text-foreground">{text}</strong>
    </p>
  );
}

function CopyField({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className={`flex-1 break-all rounded-lg bg-muted px-3 py-2 font-mono ${big ? "text-base font-bold" : "text-sm"}`}>{value}</code>
        <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copié"); }}>
          <Copy className="h-4 w-4" /> Copier
        </Button>
      </div>
    </div>
  );
}

function PaymentPanel({ order, methods, onReload }: { order: Order; methods: PaymentMethod[]; onReload: () => Promise<void> }) {
  const payment = order.payment;
  const method = payment.method;

  if (CRYPTO_METHODS.has(method)) {
    return (
      <div className="space-y-4 border-t border-border pt-5">
        <p className="text-center">
          <span className="text-2xl font-extrabold">{payment.amount} {payment.symbol}</span>
        </p>
        {payment.address && (
          <>
            <CopyField label={`Adresse ${payment.symbol ?? ""}`} value={payment.address} />
            <div className="flex justify-center rounded-lg bg-white p-4">
              <QRCodeSVG value={payment.address} size={160} />
            </div>
          </>
        )}
        {method === "ton" && payment.memo && (
          <div className="space-y-2">
            <CopyField label="Mémo / commentaire" value={payment.memo} big />
            <p className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-center text-sm font-semibold text-warning">
              Mémo obligatoire : sans lui, votre paiement ne pourra pas être rattaché à votre commande.
            </p>
          </div>
        )}
        <p className="text-center text-sm text-muted-foreground">
          Envoyez exactement ce montant avant l'expiration. La validation est automatique.
        </p>
      </div>
    );
  }

  if (method === "stripe") {
    return <StripePanel orderId={order.id} onReload={onReload} />;
  }

  if (method === "paypal_ff") {
    const declaration = methods.find((m) => m.code === "paypal_ff")?.txidDeclaration ?? false;
    return <PaypalPanel order={order} txidDeclaration={declaration} onReload={onReload} />;
  }

  return (
    <p className="border-t border-border pt-5 text-center text-sm text-muted-foreground">
      Suivez les instructions de paiement de {payment.label}.
    </p>
  );
}

function StripePanel({ orderId, onReload }: { orderId: string; onReload: () => Promise<void> }) {
  const checkout = useServerFn(stripeCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const r = await checkout({ data: { id: orderId, returnUrl: window.location.href } });
      if (r.ok) {
        window.location.href = r.url;
        return;
      }
      if (r.code === "order_not_payable") {
        await onReload();
        return;
      }
      setError(r.message);
    } catch {
      setError("Erreur lors de la création du paiement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-5">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" variant="hero" size="lg" onClick={pay} disabled={busy}>
        {busy ? "Redirection…" : "Payer par carte"}
      </Button>
    </div>
  );
}

function PaypalPanel({ order, txidDeclaration, onReload }: { order: Order; txidDeclaration: boolean; onReload: () => Promise<void> }) {
  const declareTx = useServerFn(paypalTxid);
  const [txid, setTxid] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const payment = order.payment;

  async function submitTx(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await declareTx({ data: { id: order.id, txid, paypalEmail, name } });
      if (r.ok) {
        setSent(true);
        return;
      }
      if (r.code === "order_not_payable") {
        await onReload();
        return;
      }
      setError(r.message);
    } catch {
      setError("Erreur lors de l'envoi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-border pt-5">
      <p className="text-sm">
        Envoyez <strong>{formatEur(order.priceEur)}</strong> en PayPal « Entre proches » à l'adresse ci-dessous
        avec EXACTEMENT la note indiquée.
      </p>
      {payment.address && <CopyField label="Adresse PayPal" value={payment.address} />}
      {payment.memo && <CopyField label="Note (obligatoire, à copier exactement)" value={payment.memo} big />}

      {txidDeclaration && !sent && (
        <form onSubmit={submitTx} className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm font-semibold">J'ai payé</p>
          <div className="space-y-1">
            <Label htmlFor="txid">ID de transaction</Label>
            <Input id="txid" value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Ex. 8AB12345CD678901E" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pp-email">Email PayPal</Label>
            <Input id="pp-email" type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="vous@exemple.fr" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pp-name">Nom</Label>
            <Input id="pp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du compte PayPal" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="hero" className="w-full" disabled={busy}>
            {busy ? "Envoi…" : "Déclarer mon paiement"}
          </Button>
        </form>
      )}
      {txidDeclaration && sent && (
        <p className="rounded-lg bg-muted p-3 text-center text-sm font-semibold">
          En vérification — votre paiement est en cours de contrôle.
        </p>
      )}
    </div>
  );
}
