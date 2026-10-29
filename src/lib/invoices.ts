import { z } from "zod";
import type { Delivery } from "./playlist-security";

export const invoiceSearchSchema = z.object({
  status: z.string().max(40).catch(""), method: z.string().max(40).catch(""),
  q: z.string().max(200).catch(""), page: z.coerce.number().int().min(1).catch(1),
});
export type InvoiceSearch = z.infer<typeof invoiceSearchSchema>;
export type InvoicePayment = { method: string; label: string; amount: string | number | null; symbol: string | null; address: string | null; memo: string | null };
export type Invoice = {
  id: string; number: string; plan: string; createdAt: string | null; priceEur: number;
  state: string; source: string; payable: boolean; cancellable: boolean; expiresAt: string | null;
  orderId: string | null; payment: InvoicePayment; hasDelivery: boolean;
};
export const INVOICE_STATES = ["pending", "detected", "review", "paid", "activated", "expired", "cancelled"] as const;
export const invoiceStatusLabels: Record<string, string> = { pending: "En attente", detected: "Paiement détecté", review: "À vérifier", paid: "Payée", activated: "Payée", expired: "Expirée", cancelled: "Annulée" };
export function invoicePolls(state: string) { return state === "pending" || state === "detected"; }
export function invoiceCanPay(i: Pick<Invoice, "priceEur" | "payable" | "source">) { return i.payable && i.priceEur > 0 && i.source !== "hypertv"; }
export function invoiceCanCancel(i: Pick<Invoice, "state" | "source" | "cancellable">) { return i.source !== "hypertv" && i.cancellable && invoicePolls(i.state); }
export function invoiceCurrency(value: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value); }
type ApiRecord = Partial<Record<"invoice" | "payment" | "order" | "priceEur" | "id" | "number" | "plan" | "name" | "createdAt" | "date" | "state" | "status" | "source" | "payable" | "cancellable" | "cancelable" | "expiresAt" | "orderId" | "delivery" | "method" | "label" | "amount" | "symbol" | "address" | "memo" | "xtream" | "m3uUrl" | "serverUrl" | "username" | "password" | "replacedId" | "total" | "page" | "pageSize" | "limit" | "invoices", unknown>>;
export function record(value: unknown): ApiRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : {}; }
const text = (v: unknown): string | null => typeof v === "string" ? v : null;
export function normalizeInvoice(raw: unknown): Invoice {
  const outer = record(raw), i = record(outer.invoice ?? raw), p = record(i.payment), o = record(i.order);
  const price = typeof i.priceEur === "number" ? i.priceEur : Number(i.priceEur);
  return {
    id: text(i.id) ?? "", number: String(i.number ?? "—"), plan: text(i.plan) ?? text(record(i.plan).name) ?? "Abonnement",
    createdAt: text(i.createdAt) ?? text(i.date), priceEur: Number.isFinite(price) ? price : 0,
    state: text(i.state) ?? text(i.status) ?? "unknown", source: text(i.source) ?? "shop",
    payable: i.payable === true, cancellable: i.cancellable !== false && i.cancelable !== false,
    expiresAt: text(i.expiresAt), orderId: text(o.id) ?? text(i.orderId), hasDelivery: !!i.delivery,
    payment: { method: text(p.method) ?? "", label: text(p.label) ?? "—", amount: typeof p.amount === "number" || typeof p.amount === "string" ? p.amount : null, symbol: text(p.symbol), address: text(p.address), memo: text(p.memo) },
  };
}
export function normalizeInvoiceDelivery(raw: unknown): Delivery | null {
  const outer = record(raw), i = record(outer.invoice ?? raw), d = record(i.delivery), x = record(d.xtream);
  if (!text(d.m3uUrl) || !text(x.serverUrl) || !text(x.username) || !text(x.password)) return null;
  return { m3uUrl: String(d.m3uUrl), xtream: { serverUrl: String(x.serverUrl), username: String(x.username), password: String(x.password) }, expiresAt: text(d.expiresAt) };
}
export function newestInvoices(invoices: Invoice[]) { return [...invoices].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0)); }
export function replacementInvoiceId(raw: unknown, current: string) {
  const r = record(raw);
  return r.replacedId ? text(record(r.invoice).id) ?? text(record(r.order).id) ?? current : current;
}