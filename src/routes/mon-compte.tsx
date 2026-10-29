import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Copy, LogOut, RefreshCw, Receipt } from "lucide-react";
import { getMyAccount, logoutCustomer, updateUsername } from "@/lib/account.functions";
import { formatFrDate, usernameSchema } from "@/lib/account";
import { getShopInfo } from "@/lib/shop.functions";
import { GuidesShell } from "@/components/GuidesShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const shopQuery = queryOptions({ queryKey: ["shop-info"], queryFn: () => getShopInfo(), staleTime: 300_000 });

export const Route = createFileRoute("/mon-compte")({
  loader: async ({ context }) => {
    const [account, shop] = await Promise.all([getMyAccount(), context.queryClient.ensureQueryData(shopQuery)]);
    if (!account) throw redirect({ to: "/connexion" });
    return { account, shopName: shop.name };
  },
  staleTime: 0,
  head: ({ loaderData }) => {
    const title = `Mon compte — ${loaderData?.shopName ?? "Boutique"}`;
    const description = "Votre espace client HyperTV : abonnement, pseudo et appareil MAG.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: AccountPage,
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}

function AccountPage() {
  const { account } = Route.useLoaderData();
  const { data: shop } = useSuspenseQuery(shopQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(updateUsername);
  const logout = useServerFn(logoutCustomer);
  const [username, setUsername] = useState(account.username ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) return setMsg({ ok: false, text: parsed.error.issues[0]?.message ?? "Pseudo invalide" });
    setSaving(true);
    setMsg(null);
    try {
      await save({ data: { username: parsed.data } });
      setMsg({ ok: true, text: "Pseudo enregistré" });
    } catch (err) {
      const text = (err as Error).message;
      if (text.startsWith("Session expirée")) return void navigate({ to: "/connexion", replace: true });
      setMsg({ ok: false, text });
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await logout();
    qc.removeQueries({ queryKey: ["account-status"] });
    await navigate({ to: "/connexion", replace: true });
  }

  async function copyMac() {
    if (!account.mac) return;
    await navigator.clipboard.writeText(account.mac);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <GuidesShell shop={shop}>
      <div className="mx-auto w-full max-w-lg space-y-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Mon compte</h1>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm"><LogOut className="h-4 w-4" /> Déconnexion</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
                <AlertDialogDescription>Vous devrez saisir à nouveau votre clé d'accès.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={onLogout}>Déconnexion</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <form onSubmit={onSave} className="space-y-3 rounded-2xl border border-border bg-card p-6">
          <Label htmlFor="username">Pseudo</Label>
          <div className="flex gap-2">
            <Input id="username" value={username} maxLength={30} onChange={(e) => setUsername(e.target.value)} />
            <Button type="submit" disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
          </div>
          {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
        </form>

        <div className="rounded-2xl border border-border bg-card px-6 py-2">
          <Row label="Grade">{account.grade ?? "—"}</Row>
          <Row label="Inscription">{formatFrDate(account.createdAt)}</Row>
          <Row label="Abonnement">
            {account.subscription.active
              ? <span className="text-success">Abonné jusqu'au {formatFrDate(account.subscription.expiresAt)}</span>
              : <span className="text-muted-foreground">Aucun abonnement actif</span>}
          </Row>
          <Row label="Playlists">{account.playlistsCount}</Row>
          <Row label="MAC MAG">
            {account.mac ? (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono">{account.mac}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Copier la MAC" onClick={copyMac}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </span>
            ) : "—"}
          </Row>
        </div>

        <Button asChild className="w-full">
          <Link to="/"><RefreshCw className="h-4 w-4" /> Renouveler</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/mon-compte/factures" search={{ status: "", method: "", q: "", page: 1 }}><Receipt className="h-4 w-4" /> Mes factures</Link>
        </Button>
      </div>
    </GuidesShell>
  );
}
