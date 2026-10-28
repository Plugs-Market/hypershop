import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminDashboard, adminTestActivate } from "@/lib/shop.functions";
import { isValidMac, normalizeMac } from "@/lib/hypertv-shared";
import { SiteHeader } from "@/components/SiteHeader";
import { AdminNav } from "@/components/AdminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/test-api")({
  head: () => ({
    meta: [
      { title: "Test API — HyperTV admin" },
      { name: "description", content: "Vérification de la liaison avec l'API HyperTV." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Test API — HyperTV admin" },
      { property: "og:description", content: "Vérification de la liaison API." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TestApi,
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-3 text-lg font-bold">{title}</h2>{children}</section>;
}

function TestApi() {
  const dash = useServerFn(adminDashboard);
  const act = useServerFn(adminTestActivate);
  const q = useQuery({ queryKey: ["admin-dash"], queryFn: () => dash(), retry: false });
  const [mac, setMac] = useState("");
  const [planId, setPlanId] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (q.isLoading) return <div className="min-h-screen"><SiteHeader /><p className="p-12 text-center text-muted-foreground">Chargement…</p></div>;
  if (q.error) return <div className="min-h-screen"><SiteHeader /><p className="p-12 text-center text-destructive">{(q.error as Error).message}</p></div>;
  const d = q.data!;
  const plans = d.offers.ok ? d.offers.data.subscriptionPlans : [];
  const connected = d.offers.ok || d.balance.ok;

  async function test(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidMac(mac)) return setRaw("Adresse MAC invalide (XX:XX:XX:XX:XX:XX).");
    setBusy(true);
    try { setRaw((await act({ data: { mac: normalizeMac(mac), planId } })).response); }
    catch (err) { setRaw((err as Error).message); }
    finally { setBusy(false); q.refetch(); }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <AdminNav />
        <h1 className="mb-6 text-3xl font-bold">Test de la liaison API</h1>
        <div className="grid gap-5 md:grid-cols-2">
          <Card title="Connexion">
            <p className={connected ? "text-success" : "text-destructive"}>{connected ? "● Connectée" : "● Échec"}</p>
            {!d.offers.ok && <p className="mt-2 text-sm text-muted-foreground">{d.offers.error.message} ({d.offers.error.status} {d.offers.error.code})</p>}
          </Card>
          <Card title="Solde de crédits">
            {d.balance.ok ? <p className="text-4xl font-extrabold">{d.balance.data.credits}</p> : <p className="text-sm text-destructive">{d.balance.error.message}</p>}
          </Card>
          <Card title="Formules">
            <ul className="space-y-1 text-sm">
              {plans.map((p) => <li key={p.id} className="flex justify-between gap-2"><span>{p.name} · {p.duration_days} j · {p.max_devices} écran(s)</span><span className="font-mono text-muted-foreground">{p.reseller_credits} cr · {p.id}</span></li>)}
              {plans.length === 0 && <li className="text-muted-foreground">Aucune formule.</li>}
            </ul>
          </Card>
          <Card title="Activation test">
            <form onSubmit={test} className="space-y-3">
              <div className="space-y-1"><Label>MAC</Label><Input className="font-mono" value={mac} onChange={(e) => setMac(e.target.value.toUpperCase())} placeholder="00:1A:79:AB:CD:EF" /></div>
              <div className="space-y-1"><Label>Formule</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
                  <option value="">Choisir…</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <Button type="submit" disabled={busy} variant="hero">Activer (débite des crédits)</Button>
            </form>
            {raw && <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">{raw}</pre>}
          </Card>
        </div>
        <div className="mt-5">
          <Card title="Clients">
            {d.customers.ok ? (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="text-left text-muted-foreground"><tr><th className="py-2">MAC</th><th>Utilisateur</th><th>Formule</th><th>Statut</th><th>Expire</th></tr></thead>
                <tbody>{d.customers.data.customers.map((c) => (
                  <tr key={c.mac} className="border-t border-border"><td className="py-2 font-mono">{c.mac}</td><td>{c.username}</td><td>{c.plan}</td><td>{c.status}</td><td>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("fr-FR") : "—"}</td></tr>
                ))}</tbody>
              </table>{d.customers.data.customers.length === 0 && <p className="text-muted-foreground">Aucun client.</p>}</div>
            ) : <p className="text-sm text-destructive">{d.customers.error.message}</p>}
          </Card>
        </div>
      </main>
    </div>
  );
}
