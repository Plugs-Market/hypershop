import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, ImagePlus, Lock, RotateCcw, Send, X } from "lucide-react";
import { getAccountStatus } from "@/lib/account.functions";
import { getSupportAttachment, markSupportRead, requestSupportUploads, sendSupportMessage, setSupportStatus } from "@/lib/support.functions";
import { attachmentsError, categoryLabel, mergeById, readMessageId, SUPPORT_ERRORS, supportStatusLabel, type Attachment, type MessagePayload } from "@/lib/support";
import { decryptBytes, decryptJson, encryptBytes, encryptJson, readTicketCache, writeTicketCache, type TicketCache } from "@/lib/support-crypto";
import { loadTicket, useSupportContext, useSupportLive } from "@/lib/support-client";
import { shopQuery } from "./mon-compte";
import { SupportStatusBadge } from "./mon-compte_.support";
import { GuidesShell } from "@/components/GuidesShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/mon-compte_/support_/$id")({
  beforeLoad: async () => {
    const s = await getAccountStatus();
    if (!s.loggedIn) throw redirect({ to: "/connexion" });
  },
  loader: async ({ context }) => ({ shopName: (await context.queryClient.ensureQueryData(shopQuery)).name }),
  head: ({ loaderData }) => {
    const title = `Demande d'assistance — ${loaderData?.shopName ?? "Boutique"}`, description = "Conversation chiffrée avec le support.";
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] };
  },
  component: Conversation,
});

type Msg = { id: string; from: "customer" | "staff"; createdAt: string; statusChange: string | null; text: string; atts: Attachment[] };
const isLocal = (m: Msg) => m.id.startsWith("local-");
const time = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "" : d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };

function Conversation() {
  const { id } = Route.useParams();
  const { data: shop } = useSuspenseQuery(shopQuery);
  const navigate = useNavigate();
  const { ctx, error: ctxError } = useSupportContext();
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [ticket, setTicket] = useState<{ status: string; category: string; subject: string | null } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [staffReadAt, setStaffReadAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const lastAt = useRef<string | undefined>(undefined);
  const messagesArea = useRef<HTMLDivElement>(null);

  const handle = useCallback((e: unknown) => {
    const m = e instanceof Error ? e.message : "Support momentanément indisponible.";
    if (m === SUPPORT_ERRORS.session) return void navigate({ to: "/connexion", replace: true });
    if (m === SUPPORT_ERRORS.notFound) return setNotFound(true);
    setError(m);
  }, [navigate]);

  const etag = useRef<string | null>(null);
  const loaded = useRef(false);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const msgsRef = useRef<Msg[]>([]);
  msgsRef.current = msgs;
  const persist = useCallback((patch: Partial<TicketCache<Msg>>) => {
    if (!ctx) return;
    const t = ticketRef.current;
    if (!t) return;
    void writeTicketCache<Msg>(ctx.customerId, id, { status: t.status, category: t.category, subject: t.subject, staffReadAt: staffReadRef.current, etag: etag.current, messages: msgsRef.current.filter((m) => !isLocal(m)), ...patch });
  }, [ctx, id]);
  const ticketRef = useRef(ticket);
  ticketRef.current = ticket;
  const staffReadRef = useRef(staffReadAt);
  staffReadRef.current = staffReadAt;

  const readOnce = useCallback(async (full: boolean) => {
    if (!ctx) return;
    try {
      if (full) { lastAt.current = undefined; etag.current = null; }
      const first = !loaded.current || full;
      const { notModified, detail, key: k } = await loadTicket(id, ctx.device, { after: lastAt.current, includeDevices: first, etag: etag.current });
      loaded.current = true;
      if (notModified || !detail) return;
      etag.current = detail.etag ?? null;
      if (!k) { setNoKey(true); setTicket({ status: detail.ticket.status, category: detail.ticket.category, subject: null }); return; }
      setKey(k);
      let subject = ticketRef.current?.subject ?? null;
      if (!subject && detail.ticket.subject) {
        const subj = await decryptJson<string | { t?: string }>(k, detail.ticket.subject).catch(() => null);
        subject = (typeof subj === "string" ? subj : subj?.t) ?? null;
      }
      const nextTicket = { status: detail.ticket.status, category: detail.ticket.category, subject };
      setTicket(nextTicket); ticketRef.current = nextTicket;
      if (detail.staffReadAt) { setStaffReadAt(detail.staffReadAt); staffReadRef.current = detail.staffReadAt; }
      const known = new Set(msgsRef.current.map((m) => m.id));
      const fresh = detail.messages.filter((m) => full || !known.has(m.id));
      const decoded = await Promise.all(fresh.map(async (m): Promise<Msg> => {
        const p = await decryptJson<MessagePayload>(k, m).catch(() => ({ t: "Message illisible sur cet appareil" } as MessagePayload));
        return { id: m.id, from: m.from, createdAt: m.createdAt, statusChange: m.statusChange, text: p.t ?? "", atts: Array.isArray(p.atts) ? p.atts : [] };
      }));
      const lastServer = detail.messages[detail.messages.length - 1]?.createdAt;
      if (lastServer && (!lastAt.current || lastServer > lastAt.current)) lastAt.current = lastServer;
      if (decoded.some((m) => m.from === "staff")) void markSupportRead({ data: { id } }).catch(() => null);
      const base = full ? msgsRef.current.filter(isLocal) : msgsRef.current;
      const withoutTemps = decoded.some((m) => m.from === "customer") ? base.filter((m) => !isLocal(m)) : base;
      const next = mergeById(withoutTemps, decoded);
      msgsRef.current = next;
      setMsgs(next);
      persist({ messages: next.filter((m) => !isLocal(m)) });
      setError(null);
    } catch (e) { handle(e); }
  }, [ctx, id, handle, persist]);

  // Lectures sérialisées : un événement pendant une lecture en relance une seule après.
  const load = useCallback(async (full = false) => {
    if (running.current) { again.current = true; return running.current; }
    const run = (async () => {
      await readOnce(full);
      while (again.current) { again.current = false; await readOnce(false); }
    })().finally(() => { running.current = null; });
    running.current = run;
    return run;
  }, [readOnce]);

  useEffect(() => {
    if (!ctx) return;
    let alive = true;
    (async () => {
      const cached = await readTicketCache<Msg>(ctx.customerId, id);
      if (alive && cached && cached.messages.length) {
        msgsRef.current = cached.messages;
        setMsgs(cached.messages);
        setTicket({ status: cached.status, category: cached.category, subject: cached.subject });
        setStaffReadAt(cached.staffReadAt);
        lastAt.current = cached.messages[cached.messages.length - 1]?.createdAt || undefined;
      }
      if (alive) await load();
    })();
    void markSupportRead({ data: { id } }).catch(() => null);
    return () => { alive = false; };
  }, [ctx, id, load]);
  useEffect(() => { if (ctxError) handle(ctxError); }, [ctxError, handle]);
  useEffect(() => {
    const area = messagesArea.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [msgs.length]);
  useSupportLive(() => void load(), !!ctx && !noKey);

  async function changeStatus(status: "resolved" | "open") {
    if (!key || !ticket) return;
    try {
      const c = await encryptJson(key, { t: status === "resolved" ? "Demande marquée résolue" : "Demande marquée non résolue" });
      await setSupportStatus({ data: { id, expected: ticket.status, status, ...c } });
    } catch (e) {
      if (e instanceof Error && e.message === SUPPORT_ERRORS.conflict) setError("Le statut a changé, la demande a été rechargée.");
      else handle(e);
    }
    await load(true);
  }

  const readId = readMessageId(msgs, staffReadAt);
  const back = <Button variant="ghost" size="sm" className="shrink-0 px-2" asChild><Link to="/mon-compte/support" aria-label="Retour aux demandes" title="Retour aux demandes"><ArrowLeft /><span className="hidden sm:inline">Mes demandes</span></Link></Button>;

  if (notFound) return <GuidesShell shop={shop} conversation><div className="mx-auto w-full max-w-3xl space-y-4 p-4">{back}<h1 className="text-2xl font-bold">Demande introuvable</h1></div></GuidesShell>;

  return (
    <GuidesShell shop={shop} conversation>
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3 sm:gap-3 sm:px-4">
          {back}
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 break-words text-sm font-bold sm:text-lg" title={ticket?.subject ?? undefined}>{ticket?.subject ?? "Demande d'assistance"}</h1>
            {ticket && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3 shrink-0" aria-label="Chiffré de bout en bout" /><span>{categoryLabel(ticket.category)}</span><span className="hidden sm:inline"> · chiffré de bout en bout</span></p>}
          </div>
          {ticket && <div className="flex max-w-[45%] shrink-0 items-center gap-1 sm:max-w-none sm:gap-2">
            <SupportStatusBadge status={ticket.status} />
            {key && ticket.status !== "closed" && (ticket.status === "resolved"
              ? <ConfirmStatus label="Non résolu" icon={<RotateCcw />} text="La demande sera rouverte." onConfirm={() => changeStatus("open")} />
              : <ConfirmStatus label="Résolu" icon={<Check />} text="La demande sera marquée comme résolue." onConfirm={() => changeStatus("resolved")} />)}
          </div>}
        </div>
        <div ref={messagesArea} role="region" aria-label="Messages de la discussion" tabIndex={0} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-4 pb-2">
          <div className="mt-auto flex shrink-0 flex-col gap-3">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {noKey && <p className="text-sm text-muted-foreground">Cette demande a été ouverte sur un autre appareil : son contenu n'est pas lisible ici.</p>}
          {!ticket && !error && <p className="text-sm text-muted-foreground">Déchiffrement…</p>}
          {msgs.length === 0 && ticket && !noKey && <p className="py-6 text-center text-sm text-muted-foreground">Aucun message.</p>}
          {msgs.map((m) => m.statusChange ? (
            <p key={m.id} className="mx-auto rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
              {m.text || `Statut : ${supportStatusLabel(m.statusChange)}`} · {time(m.createdAt)}
            </p>
          ) : (
            <div key={m.id} className={`flex shrink-0 flex-col ${m.from === "customer" ? "items-end" : "items-start"}`}>
              <div className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.from === "customer" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"}`}>
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                {key && m.atts.length > 0 && <div className="mt-2 grid grid-cols-3 gap-2">{m.atts.map((a) => <AttachmentImage key={a.p} ticketId={id} att={a} ticketKey={key} />)}</div>}
              </div>
              <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                {m.from === "staff" ? "Équipe" : "Vous"} · {time(m.createdAt)}
                {m.id === readId && <><CheckCheck className="h-3 w-3 text-primary" />Lu</>}
              </span>
            </div>
          ))}
          </div>
        </div>

        {key && ticket?.status !== "closed" && <Composer ticketId={id} ticketKey={key} name={ctx?.username ?? null} onSent={() => load()} onError={handle}
          onOptimistic={(m) => setMsgs((old) => { const next = mergeById(old, [m]); msgsRef.current = next; return next; })}
          onConfirmed={(tempId, real) => setMsgs((old) => { const next = real ? old.map((m) => (m.id === tempId ? { ...m, ...real } : m)) : old; msgsRef.current = next; return next; })}
          onFailed={(tempId) => setMsgs((old) => { const next = old.filter((m) => m.id !== tempId); msgsRef.current = next; return next; })} />}
      </div>
    </GuidesShell>
  );
}

function ConfirmStatus({ label, icon, text, onConfirm }: { label: string; icon: React.ReactNode; text: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="shrink-0 px-2 sm:px-3" aria-label={label} title={label}>{icon}<span className="hidden sm:inline">{label}</span></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Marquer « {label} » ?</AlertDialogTitle><AlertDialogDescription>{text}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Confirmer</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Composer({ ticketId, ticketKey, name, onSent, onError, onOptimistic, onConfirmed, onFailed }: {
  ticketId: string; ticketKey: CryptoKey; name: string | null; onSent: () => Promise<void>; onError: (e: unknown) => void;
  onOptimistic: (m: Msg) => void; onConfirmed: (tempId: string, real: { id: string; createdAt: string } | null) => void; onFailed: (tempId: string) => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function addFiles(list: FileList | null) {
    const next = [...files, ...Array.from(list ?? [])];
    const e = attachmentsError(next);
    if (e) return setErr(e);
    setErr(null); setFiles(next);
  }

  async function send() {
    if (busy || (!text.trim() && !files.length)) return;
    setBusy(true); setErr(null);
    let tempId: string | null = null;
    const draft = text, draftFiles = files;
    try {
      const atts: Attachment[] = [];
      if (files.length) {
        const encrypted = await Promise.all(files.map(async (f) => ({ f, ...(await encryptBytes(ticketKey, await f.arrayBuffer())) })));
        const uploads = await requestSupportUploads({ data: { id: ticketId, files: encrypted.map((e) => ({ mime: e.f.type, size: e.data.byteLength })) } });
        if (uploads.length !== encrypted.length) throw new Error("Envoi des photos impossible.");
        await Promise.all(uploads.map(async (u, i) => {
          const enc = encrypted[i];
          if (!enc) throw new Error("Envoi des photos impossible.");
          const r = await fetch(u.uploadUrl, { method: "PUT", body: enc.data, headers: { "Content-Type": "application/octet-stream" } });
          if (!r.ok) throw new Error("Envoi des photos impossible.");
          atts.push({ p: u.path, m: enc.f.type, s: enc.f.size, iv: enc.iv });
        }));
      }
      const payload: MessagePayload = { t: text.trim(), ...(name ? { n: name } : {}), ...(atts.length ? { atts } : {}) };
      const cipher = await encryptJson(ticketKey, payload);
      tempId = `local-${crypto.randomUUID()}`;
      onOptimistic({ id: tempId, from: "customer", createdAt: new Date().toISOString(), statusChange: null, text: payload.t ?? "", atts });
      setText(""); setFiles([]);
      const sent = await sendSupportMessage({ data: { id: ticketId, ...cipher } });
      onConfirmed(tempId, sent.id && sent.createdAt ? { id: sent.id, createdAt: sent.createdAt } : null);
      tempId = null;
      await onSent();
    } catch (e) {
      if (tempId) { onFailed(tempId); setText(draft); setFiles(draftFiles); }
      const m = e instanceof Error ? e.message : "Envoi impossible.";
      if (m === SUPPORT_ERRORS.session || m === SUPPORT_ERRORS.notFound) onError(e); else setErr(m);
    } finally { setBusy(false); }
  }

  return (
    <div className="shrink-0 space-y-2 bg-background px-3 pt-2 pb-2 sm:px-4">
      {previews.length > 0 && <div className="flex flex-wrap gap-2">{previews.map((u, i) => (
        <div key={u} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
          <img src={u} alt="" className="h-full w-full object-cover" />
          <Button type="button" size="icon" variant="ghost" aria-label="Retirer la photo" className="absolute right-0 top-0 h-6 w-6 rounded-bl bg-background/80" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
        </div>))}</div>}
      <div className="flex items-end gap-2 rounded-lg border border-input bg-card p-2 focus-within:border-ring">
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Ajouter des photos" disabled={busy || files.length >= 6} onClick={() => input.current?.click()}><ImagePlus /></Button>
        <Textarea rows={1} value={text} maxLength={5000} aria-label="Votre message" placeholder="Votre message…" className="max-h-32 min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <Button type="button" size="icon" className="h-10 w-10 shrink-0" aria-label="Envoyer" disabled={busy} onClick={() => void send()}><Send /></Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );
}

function AttachmentImage({ ticketId, att, ticketKey }: { ticketId: string; att: Attachment; ticketKey: CryptoKey }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true, made: string | null = null;
    (async () => {
      const { url: signed } = await getSupportAttachment({ data: { id: ticketId, path: att.p } });
      const r = await fetch(signed);
      if (!r.ok) throw new Error();
      const plain = await decryptBytes(ticketKey, await r.arrayBuffer(), att.iv);
      made = URL.createObjectURL(new Blob([plain], { type: att.m.startsWith("image/") ? att.m : "image/jpeg" }));
      if (alive) setUrl(made); else URL.revokeObjectURL(made);
    })().catch(() => alive && setFailed(true));
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [ticketId, att.p, att.iv, att.m, ticketKey]);
  if (failed) return <div className="grid aspect-square place-items-center rounded-lg bg-background/40 text-[10px]">Photo indisponible</div>;
  if (!url) return <div className="aspect-square animate-pulse rounded-lg bg-background/40" />;
  return (
    <>
      <Button type="button" variant="ghost" aria-label="Agrandir la photo jointe" onClick={() => setOpen(true)} className="h-auto overflow-hidden rounded-lg p-0"><img src={url} alt="Photo jointe" className="aspect-square w-full object-cover" /></Button>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-3xl"><DialogTitle className="sr-only">Photo jointe</DialogTitle><img src={url} alt="Photo jointe" className="max-h-[80vh] w-full object-contain" /></DialogContent></Dialog>
    </>
  );
}
