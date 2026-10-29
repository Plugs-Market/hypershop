// Helpers client-safe du support (aucun contenu en clair ici).
import { z } from "zod";

export const SUPPORT_CATEGORIES = [
  { value: "account", label: "Compte" },
  { value: "subscription", label: "Abonnement" },
  { value: "playback", label: "Lecture" },
  { value: "payment", label: "Paiement" },
  { value: "other", label: "Autre" },
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];
export const categoryLabel = (c: string) => SUPPORT_CATEGORIES.find((x) => x.value === c)?.label ?? "Autre";

export function supportStatusLabel(s: string): string {
  if (s === "open") return "Ouvert";
  if (s === "resolved") return "Résolu";
  if (s === "closed") return "Fermé";
  if (/wait|pending|awaiting/.test(s)) return "En attente de vous";
  return "Ouvert";
}
export function supportStatusTone(s: string): string {
  if (s === "resolved") return "bg-success/10 text-success";
  if (s === "closed") return "bg-muted text-muted-foreground";
  if (/wait|pending|awaiting/.test(s)) return "bg-warning/10 text-warning";
  return "bg-primary/10 text-primary";
}

export const MAX_ATTACHMENTS = 6;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export function attachmentsError(files: { type: string; size: number }[]): string | null {
  if (files.length > MAX_ATTACHMENTS) return `${MAX_ATTACHMENTS} photos maximum`;
  if (files.some((f) => !f.type.startsWith("image/"))) return "Seules les photos sont acceptées";
  if (files.some((f) => f.size > MAX_ATTACHMENT_BYTES)) return "10 Mo maximum par photo";
  return null;
}

export const cipherSchema = z.object({ ct: z.string().min(1).max(200_000), iv: z.string().min(8).max(64) });
export type Cipher = z.infer<typeof cipherSchema>;
export type Attachment = { p: string; m: string; s: number; iv: string };
export type MessagePayload = { t: string; n?: string; atts?: Attachment[] };
export type WrappedKey = { wrappedKey: string; iv: string; wrapperPub: string };
export type SupportDevice = { id: string; publicKey: string; owner: string | null; hasKey: boolean | null };
export type SupportMessage = { id: string; from: "customer" | "staff"; ct: string; iv: string; statusChange: string | null; createdAt: string };
export type SupportTicketSummary = { id: string; category: string; status: string; subject: Cipher | null; lastSender: string | null; lastMessageAt: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rec = (v: unknown): any => (v && typeof v === "object" ? v : {});
const s = (v: unknown) => (typeof v === "string" ? v : null);

function cipher(v: unknown): Cipher | null {
  const r = rec(v);
  return typeof r.ct === "string" && typeof r.iv === "string" ? { ct: r.ct, iv: r.iv } : null;
}
export function normalizeTicketSummary(v: unknown): SupportTicketSummary {
  const r = rec(v);
  return { id: String(r.id ?? ""), category: s(r.category) ?? "other", status: s(r.status) ?? "open", subject: cipher(r.subject), lastSender: s(r.lastSender), lastMessageAt: s(r.lastMessageAt) };
}
export function normalizeDevices(v: unknown): SupportDevice[] {
  return (Array.isArray(v) ? v : []).map(rec).filter((d) => d.id && typeof d.publicKey === "string").map((d) => ({
    id: String(d.id), publicKey: d.publicKey, owner: s(d.owner), hasKey: typeof d.hasKey === "boolean" ? d.hasKey : null,
  }));
}
export function normalizeTicketDetail(v: unknown) {
  const root = rec(v);
  const t = rec(root.ticket ?? root);
  const k = rec(root.key);
  const statusChange = (m: Record<string, any>) => (typeof m.statusChange === "string" ? m.statusChange : m.statusChange ? s(rec(m.statusChange).status ?? rec(m.statusChange).to) ?? "changed" : null);
  return {
    ticket: { ...normalizeTicketSummary(t), id: String(t.id ?? root.id ?? "") },
    key: typeof k.wrappedKey === "string" && typeof k.iv === "string" && typeof k.wrapperPub === "string" ? ({ wrappedKey: k.wrappedKey, iv: k.iv, wrapperPub: k.wrapperPub } as WrappedKey) : null,
    messages: (Array.isArray(root.messages) ? root.messages : []).map(rec).filter((m) => m.id && typeof m.ct === "string").map((m): SupportMessage => ({
      id: String(m.id), from: m.from === "staff" ? "staff" : "customer", ct: m.ct, iv: String(m.iv ?? ""), statusChange: statusChange(m), createdAt: s(m.createdAt) ?? "",
    })),
    staffReadAt: s(root.staffReadAt),
    devices: normalizeDevices(root.devices),
  };
}

export function mergeById<T extends { id: string; createdAt: string }>(old: T[], incoming: T[]): T[] {
  const map = new Map(old.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Id du dernier message client lu par l'équipe (staffReadAt ≥ sa date).
export function readMessageId(messages: { id: string; from: string; createdAt: string; statusChange: string | null }[], staffReadAt: string | null): string | null {
  const last = [...messages].reverse().find((m) => m.from === "customer" && !m.statusChange);
  if (!last || !staffReadAt) return null;
  return Date.parse(staffReadAt) >= Date.parse(last.createdAt) ? last.id : null;
}

export const SUPPORT_ERRORS = {
  session: "Session expirée, reconnectez-vous",
  subscribers: "Le support est réservé aux abonnés",
  notFound: "Demande introuvable",
  conflict: "Le statut a changé entre-temps",
};
export function translateSupportError(status: number, code: string): string {
  if (status === 401 || code === "customer_unauthorized" || code === "customer_session_expired") return SUPPORT_ERRORS.session;
  if (code === "support_subscribers_only") return SUPPORT_ERRORS.subscribers;
  if (status === 404 || code === "not_found") return SUPPORT_ERRORS.notFound;
  if (status === 409 || code === "status_conflict") return SUPPORT_ERRORS.conflict;
  if (code === "status_not_allowed") return "Action non autorisée";
  if (status === 429 || code === "too_many_attempts") return "Trop de demandes, réessayez plus tard";
  if (code === "timeout" || code === "network_error" || status === 0) return "Le support ne répond pas. Réessayez dans quelques instants.";
  return "Support momentanément indisponible.";
}
