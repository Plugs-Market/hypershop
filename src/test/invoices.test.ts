import { describe, expect, it } from "vitest";
import { invoiceCanPay, invoiceCanCancel, invoicePolls, normalizeInvoice, normalizeInvoiceDelivery, invoiceSearchSchema, replacementInvoiceId, newestInvoices, INVOICE_POLL_INTERVAL } from "@/lib/invoices";
describe("customer invoices", () => {
  it("résout le fournisseur de la formule commandée sans conserver les accès", () => {
    const raw = { id: "8k", type: "trex", order: { trexPlanId: "8k-plan" }, delivery: { xtream: { password: "private-pass" } } };
    const plans = [{ id: "8k-plan", type: "trex", provider: "8kpro", title: "Annuel", currency: "EUR", line: { type: "m3u", months: 12, durationDays: 365 }, includesHypertvSubscription: null }] as const;
    expect(normalizeInvoice(raw, [...plans]).provider).toBe("8kpro");
    expect(normalizeInvoice({ id: "legacy", type: "trex" }).provider).toBe("trex");
    expect(normalizeInvoice({ ...raw, provider: "8kpro" }).provider).toBe("8kpro");
    expect(JSON.stringify(normalizeInvoice(raw, [...plans]))).not.toContain("private-pass");
  });
  it("preserves delivered status from direct or nested order delivery without credentials", () => {
    for (const raw of [{ id: "old", delivery: { status: "delivered", password: "private-pass" } }, { id: "old", order: { id: "old", delivery: { mode: "manual", status: "delivered", password: "private-pass" } } }]) {
      const invoice = normalizeInvoice(raw);
      expect(invoice.deliveryStatus).toBe("delivered");
      expect(JSON.stringify(invoice)).not.toContain("private-pass");
    }
  });
  it("uses root ticket fields for failed TREX and manual LION orders", () => {
    for (const type of ["trex", "lion"]) {
      const invoice = normalizeInvoice({ id: "order", type, state: "paid_activation_failed", supportTicketRequired: true, supportTicketId: "root-ticket", suggestedTicket: { category: "subscription", subject: "Subject", message: "Message" }, delivery: { mode: "manual", status: "awaiting_reseller", supportTicketId: "wrong-nested-ticket" } });
      expect(invoice.supportTicketId).toBe("root-ticket");
      expect(invoice.supportTicketRequired).toBe(true);
      expect(invoice.suggestedTicket?.message).toBe("Message");
      expect(invoice.lionDelivery?.supportTicketId).toBe("root-ticket");
    }
  });
  it("interdit tout mode pour une facture gratuite même payable", () => { expect(invoiceCanPay({ priceEur: 0, payable: true, source: "shop" })).toBe(false); expect(invoiceCanPay({ priceEur: 20, payable: true, source: "shop" })).toBe(true); });
  it("garde les factures HyperTV en lecture seule", () => { expect(invoiceCanPay({ priceEur: 20, payable: true, source: "hypertv" })).toBe(false); expect(invoiceCanCancel({ state: "pending", source: "hypertv", cancellable: true })).toBe(false); });
  it("actualise uniquement pending et detected toutes les 20 secondes", () => { expect(INVOICE_POLL_INTERVAL).toBe(20_000); expect(invoicePolls("pending")).toBe(true); expect(invoicePolls("detected")).toBe(true); for (const s of ["review", "paid", "activated", "expired", "cancelled"]) expect(invoicePolls(s)).toBe(false); });
  it("omet tous les accès IPTV de la représentation de facture", () => { const raw = { id: "a", priceEur: 12, delivery: { m3uUrl: "private", xtream: { serverUrl: "server", username: "user", password: "private-pass" } } }; expect(normalizeInvoice(raw)).not.toHaveProperty("delivery"); expect(JSON.stringify(normalizeInvoice(raw))).not.toContain("private-pass"); expect(normalizeInvoiceDelivery(raw)?.xtream.password).toBe("private-pass"); });
  it("prend la nouvelle facture order.id en cas de remplacement", () => { expect(replacementInvoiceId({ replacedId: "old", order: { id: "new" } }, "old")).toBe("new"); expect(replacementInvoiceId({ order: { id: "order" } }, "current")).toBe("current"); });
  it("conserve filtres et recherche tout en validant la page", () => { expect(invoiceSearchSchema.parse({ q: "VIP", status: "paid", method: "stripe", page: "2" })).toEqual({ q: "VIP", status: "paid", method: "stripe", page: 2 }); expect(invoiceSearchSchema.parse({ page: -1 }).page).toBe(1); });
  it("classe les factures récentes avant les anciennes", () => { expect(newestInvoices([normalizeInvoice({ id: "old", createdAt: "2026-01-01" }), normalizeInvoice({ id: "new", createdAt: "2026-10-29" })]).map(i => i.id)).toEqual(["new", "old"]); });
});