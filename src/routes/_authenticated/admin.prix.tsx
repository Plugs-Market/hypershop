import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminPrices, savePrice } from "@/lib/shop.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { AdminNav } from "@/components/AdminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/prix")({
  head: () => ({
    meta: [
      { title: "Prix de vente — HyperTV admin" },
      { name: "description", content: "Définir les prix publics des formules HyperTV." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Prix de vente — HyperTV admin" },
      { property: "og:description", content: "Prix publics des formules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Prices,
});

function Row({ plan, product, onSaved }: { plan: { id: string; name: string; duration_days: number; reseller_credits: number }; product: { price_cents: number; active: boolean } | undefined; onSaved: () => void }) {
  const save = useServerFn(savePrice);
  const [price, setPrice] = useState(product ? (product.price_cents / 100).toFixed(2) : "");
  const [active, setActive] = useState(product?.active ?? true);
  const [busy, setBusy] = useState(false);
  async function submit() {
    const cents = Math.round(parseFloat(price.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) { toast.error("Prix invalide"); return; }
    setBusy(true);
    try { await save({ data: { planId: plan.id, priceCents: cents, active } }); toast.success("Prix enregistré"); onSaved(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-48 flex-1"><p className="font-semibold">{plan.name}</p><p className="text-xs text-muted-foreground">{plan.duration_days} j · coût {plan.reseller_credits} crédits</p></div>
      <div className="flex items-center gap-1"><Input className="w-28" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" inputMode="decimal" /><span>€</span></div>
      <label className="flex items-center gap-2 text-sm"><Switch checked={active} onCheckedChange={setActive} /> En vente</label>
      <Button onClick={submit} disabled={busy} size="sm">Enregistrer</Button>
    </div>
  );
}

function Prices() {
  const fn = useServerFn(adminPrices);
  const q = useQuery({ queryKey: ["admin-prices"], queryFn: () => fn(), retry: false });
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <AdminNav />
        <h1 className="mb-2 text-3xl font-bold">Prix de vente</h1>
        <p className="mb-6 text-sm text-muted-foreground">Seules les formules avec un prix et « En vente » activé apparaissent dans la boutique.</p>
        {q.isLoading && <p className="text-muted-foreground">Chargement…</p>}
        {q.error && <p className="text-destructive">{(q.error as Error).message}</p>}
        {q.data?.error && <p className="text-destructive">{q.data.error}</p>}
        <div className="space-y-3">
          {q.data?.plans.map((p) => <Row key={p.id} plan={p} product={q.data!.products.find((x) => x.plan_id === p.id)} onSaved={() => q.refetch()} />)}
        </div>
      </main>
    </div>
  );
}
