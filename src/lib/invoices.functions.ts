import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { hypertv, HypertvError } from "./hypertvClient.server";
import { readSession, clearSession } from "./account.server";
import { SESSION_ERRORS } from "./account";
import { invoiceSearchSchema, invoiceCanPay, invoiceCanCancel, normalizeInvoice, normalizeInvoiceDelivery, record, replacementInvoiceId } from "./invoices";
import { translateHypertvError } from "./hypertv-shared";

const idSchema = z.object({ id: z.string().min(1).max(150) });
async function privateCall<T>(run: (session: string) => Promise<T>): Promise<T> {
  setResponseHeader("Cache-Control", "no-store");
  const session = readSession();
  if (!session) throw new Error("Session expirée, reconnectez-vous");
  try { return await run(session); }
  catch (e) {
    if (e instanceof HypertvError && (e.status === 401 || SESSION_ERRORS.includes(e.code))) { clearSession(); throw new Error("Session expirée, reconnectez-vous"); }
    if (e instanceof HypertvError) {
      if (e.status === 404) throw new Error("Facture introuvable");
      throw new Error(translateHypertvError(e.status, e.code, ""));
    }
    throw new Error(e instanceof Error ? e.message : "Factures momentanément indisponibles.");
  }
}
export const listCustomerInvoices = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => invoiceSearchSchema.parse(d))
  .handler(({ data }) => privateCall(async session => {
    const [raw, methods] = await Promise.all([hypertv.getInvoices(session, data), hypertv.getPaymentMethods(session)]);
    const r = record(raw);
    let pageSize = typeof r.pageSize === "number" ? r.pageSize : typeof r.limit === "number" ? r.limit : null;
    // The API contract has no page size. Read page one rather than guessing from a partial last page.
    if (pageSize === null) {
      const first = data.page === 1 ? r : record(await hypertv.getInvoices(session, { ...data, page: 1 }));
      pageSize = Array.isArray(first.invoices) ? first.invoices.length : 0;
    }
    return { total: Number(r.total) || 0, page: Number(r.page) || data.page, pageSize, invoices: Array.isArray(r.invoices) ? r.invoices.map(normalizeInvoice) : [], methods: methods.methods };
  }));
export const getCustomerInvoice = createServerFn({ method: "GET" }).inputValidator((d: unknown) => idSchema.parse(d))
  .handler(({ data }) => privateCall(async session => {
    const [raw, methods] = await Promise.all([hypertv.getInvoice(session, data.id), hypertv.getPaymentMethods(session)]);
    return { invoice: normalizeInvoice(raw), methods: methods.methods };
  }));
// IPTV credentials never enter loader data, SSR hydration or Query caches.
export const getCustomerInvoiceDelivery = createServerFn({ method: "POST" }).inputValidator((d: unknown) => idSchema.parse(d))
  .handler(({ data }) => privateCall(async session => normalizeInvoiceDelivery(await hypertv.getInvoice(session, data.id))));
export const payCustomerInvoice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.extend({ method: z.string().min(1).max(40) }).parse(d))
  .handler(({ data }) => privateCall(async session => {
    const invoice = normalizeInvoice(await hypertv.getInvoice(session, data.id));
    if (!invoiceCanPay(invoice)) throw new Error("Cette facture ne peut pas être payée.");
    const { methods } = await hypertv.getPaymentMethods(session);
    const method = methods.find(m => m.code === data.method);
    if (!method || (method.minEur != null && invoice.priceEur < method.minEur) || (method.maxEur != null && invoice.priceEur > method.maxEur)) throw new Error("Mode de paiement indisponible pour ce montant.");
    const raw = await hypertv.payInvoice(session, data.id, data.method);
    const nextId = replacementInvoiceId(raw, data.id);
    const order = record(record(raw).order);
    const orderId = typeof order.id === "string" ? order.id : null;
    if (data.method === "stripe") {
      if (!orderId) throw new Error("Paiement créé, mais la redirection est indisponible. Rechargez la facture.");
      const returnUrl = new URL(`/mon-compte/factures/${encodeURIComponent(nextId)}`, getRequestUrl()).href;
      const { url } = await hypertv.stripeCheckout(orderId, returnUrl, session);
      return { id: nextId, url };
    }
    return { id: nextId, url: null };
  }));
export const invoiceStripeCheckout = createServerFn({ method: "POST" }).inputValidator((d: unknown) => idSchema.parse(d))
  .handler(({ data }) => privateCall(async session => {
    const i = normalizeInvoice(await hypertv.getInvoice(session, data.id));
    if (i.source === "hypertv" || i.priceEur <= 0 || !i.orderId || i.payment.method !== "stripe" || !["pending", "detected"].includes(i.state)) throw new Error("Paiement indisponible.");
    return hypertv.stripeCheckout(i.orderId, new URL(`/mon-compte/factures/${encodeURIComponent(data.id)}`, getRequestUrl()).href, session);
  }));
export const invoicePaypalTxid = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.extend({ txid: z.string().trim().min(4).max(100), paypalEmail: z.string().trim().email().max(255) }).parse(d))
  .handler(({ data }) => privateCall(async session => {
    const i = normalizeInvoice(await hypertv.getInvoice(session, data.id));
    if (i.source === "hypertv" || i.priceEur <= 0 || !i.orderId || i.payment.method !== "paypal_ff" || !["pending", "detected"].includes(i.state)) throw new Error("Déclaration indisponible.");
    return hypertv.paypalTxid(i.orderId, { txid: data.txid, paypalEmail: data.paypalEmail }, session);
  }));
export const cancelCustomerInvoice = createServerFn({ method: "POST" }).inputValidator((d: unknown) => idSchema.parse(d))
  .handler(({ data }) => privateCall(async session => {
    if (!invoiceCanCancel(normalizeInvoice(await hypertv.getInvoice(session, data.id)))) throw new Error("Cette facture ne peut pas être annulée.");
    await hypertv.cancelInvoice(session, data.id);
    return { ok: true };
  }));