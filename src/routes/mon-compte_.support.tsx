import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LifeBuoy, Plus } from "lucide-react";
import { getAccountStatus } from "@/lib/account.functions";
import { createSupportTicket, listSupportTickets, sendSupportMessage } from "@/lib/support.functions";
import { categoryLabel, SUPPORT_CATEGORIES, SUPPORT_ERRORS, supportStatusLabel, supportStatusTone, type SupportCategory, type SupportTicketSummary } from "@/lib/support";
import { decryptJson, encryptJson, newTicketKey } from "@/lib/support-crypto";
import { loadTicket, rememberTicketKey, shareTicketKey, useSupportContext, useSupportLive } from "@/lib/support-client";
import { formatFrDate } from "@/lib/account";
import { shopQuery } from "./mon-compte";
import { GuidesShell } from "@/components/GuidesShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/mon-compte_/support")({
  beforeLoad: async () => {
    const s = await getAccountStatus();
    if (!s.loggedIn) throw redirect({ to: "/connexion" });
  },
  loader: async ({ context }) => ({ shopName: (await context.queryClient.ensureQueryData(shopQuery)).name }),
  head: ({ loaderData }) => {
    const title = `Support — ${loaderData?.shopName ?? "Boutique"}`, description = "Vos demandes d'assistance, chiffrées de bout en bout.";
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] };
  },
  component: SupportList,
});

type Row = SupportTicketSummary & { subjectText: string | null };

export function SupportStatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${supportStatusTone(status)}`}>{supportStatusLabel(status)}</span>;
}

function SupportList() {
  const { data: shop } = useSuspenseQuery(shopQuery);
  const navigate = useNavigate();
  const { ctx, error: ctxError } = useSupportContext();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [canCreate, setCanCreate] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback((e: unknown) => {
    const m = e instanceof Error ? e.message : "Support momentanément indisponible.";
    if (m === SUPPORT_ERRORS.session) return void navigate({ to: "/connexion", replace: true });
    setError(m);
  }, [navigate]);

  const load = useCallback(async () => {
    if (!ctx) return;
    try {
      const r = await listSupportTickets();
      setCanCreate(r.canCreate);
      const out = await Promise.all(r.tickets.map(async (t): Promise<Row> => {
        try {
          const { key } = await loadTicket(t.id, ctx.device, t.lastMessageAt ?? undefined);
          const subjectText = key && t.subject ? await decryptJson<string | { t?: string }>(key, t.subject) : null;
          return { ...t, subjectText: typeof subjectText === "string" ? subjectText : subjectText?.t ?? null };
        } catch { return { ...t, subjectText: null }; }
      }));
      setRows(out.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")));
      setError(null);
    } catch (e) { handle(e); }
  }, [ctx, handle]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (ctxError) handle(ctxError); }, [ctxError, handle]);
  useSupportLive(() => void load(), !!ctx);

  return (
    <GuidesShell shop={shop}>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" asChild><Link to="/mon-compte"><ArrowLeft />Mon compte</Link></Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-3 text-2xl font-bold"><LifeBuoy className="text-primary" />Mes demandes</h1>
          {ctx && <NewTicket disabled={!canCreate} onCreate={async (category, subject, message) => {
            const key = await newTicketKey();
            const created = await createSupportTicket({ data: { category, subject: await encryptJson(key, subject) } });
            rememberTicketKey(created.id, key);
            await shareTicketKey(created.id, key, created.devices, ctx.device, true);
            await sendSupportMessage({ data: { id: created.id, ...(await encryptJson(key, { t: message, ...(ctx.username ? { n: ctx.username } : {}) })) } });
            await navigate({ to: "/mon-compte/support/$id", params: { id: created.id } });
          }} />}
        </div>
        {!canCreate && <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Le support est réservé aux abonnés.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!rows && !error && <p className="text-sm text-muted-foreground">Chargement sécurisé…</p>}
        {rows?.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Aucune demande pour le moment.</p>}
        <ul className="space-y-3">
          {rows?.map((t) => (
            <li key={t.id}>
              <Link to="/mon-compte/support/$id" params={{ id: t.id }} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {t.lastSender === "staff" && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" aria-label="Nouvelle réponse" />}
                    <span className="truncate">{t.subjectText ?? "Demande chiffrée"}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{categoryLabel(t.category)} · {formatFrDate(t.lastMessageAt)}</p>
                </div>
                <SupportStatusBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </GuidesShell>
  );
}

function NewTicket({ disabled, onCreate }: { disabled: boolean; onCreate: (c: SupportCategory, s: string, m: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SupportCategory>("account");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3 || !message.trim()) return setErr("Renseignez un sujet et un message.");
    setBusy(true); setErr(null);
    try { await onCreate(category, subject.trim(), message.trim()); setOpen(false); }
    catch (x) { setErr(x instanceof Error ? x.message : "Envoi impossible."); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} title={disabled ? "Le support est réservé aux abonnés" : undefined}><Plus />Nouvelle demande</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle demande</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat">Catégorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as SupportCategory)}>
              <SelectTrigger id="cat"><SelectValue /></SelectTrigger>
              <SelectContent>{SUPPORT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="subj">Sujet</Label><Input id="subj" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="msg">Message</Label><Textarea id="msg" rows={5} value={message} maxLength={5000} onChange={(e) => setMessage(e.target.value)} /></div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <p className="text-xs text-muted-foreground">Chiffré de bout en bout sur cet appareil.</p>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Envoi…" : "Envoyer"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
