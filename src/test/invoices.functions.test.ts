import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), clear: vi.fn(), header: vi.fn(), invoice: vi.fn(), invoices: vi.fn(), methods: vi.fn(), pay: vi.fn(), stripe: vi.fn(), paypal: vi.fn(), cancel: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (f: unknown) => f }), handler: (f: unknown) => f }) }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: mocks.header, getRequestUrl: () => "https://shop.hypertv.win" }));
vi.mock("@/lib/account.server", () => ({ readSession: mocks.session, clearSession: mocks.clear }));
vi.mock("@/lib/hypertvClient.server", () => ({ HypertvError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }, hypertv: { getInvoice: mocks.invoice, getInvoices: mocks.invoices, getPaymentMethods: mocks.methods, payInvoice: mocks.pay, stripeCheckout: mocks.stripe, paypalTxid: mocks.paypal, cancelInvoice: mocks.cancel } }));
import { HypertvError } from "@/lib/hypertvClient.server";
import { getCustomerInvoice, listCustomerInvoices, payCustomerInvoice, cancelCustomerInvoice, invoicePaypalTxid } from "@/lib/invoices.functions";
// Mocked RPC builder exposes the handler directly, with its runtime {data} contract.
const read = getCustomerInvoice as unknown as (args: { data: { id: string } }) => Promise<unknown>;
const list = listCustomerInvoices as unknown as (args: { data: { q: string; status: string; method: string; page: number } }) => Promise<{ pageSize: number }>;
const pay = payCustomerInvoice as unknown as (args: { data: { id: string; method: string } }) => Promise<{ id: string; url: string | null }>;
const cancel = cancelCustomerInvoice as unknown as (args: { data: { id: string } }) => Promise<unknown>;
const paypal = invoicePaypalTxid as unknown as (args: { data: { id: string; txid: string; paypalEmail: string } }) => Promise<unknown>;
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockReturnValue("test-customer-session");
  mocks.invoice.mockResolvedValue({ id: "invoice", state: "pending", priceEur: 20, payable: true, source: "shop", order: { id: "owned-order" }, payment: { method: "paypal_ff" } });
  mocks.methods.mockResolvedValue({ methods: [{ code: "stripe", minEur: null, maxEur: null }, { code: "paypal_ff", minEur: null, maxEur: null }] });
  mocks.pay.mockResolvedValue({ replacedId: "invoice", order: { id: "new-invoice" } }); mocks.stripe.mockResolvedValue({ url: "https://checkout.stripe.com/test" });
});
describe("private invoice handlers", () => {
  it("refuse toute lecture sans connexion HyperTV", async () => { mocks.session.mockReturnValue(null); await expect(read({ data: { id: "invoice" } })).rejects.toThrow("Session expirée"); expect(mocks.invoice).not.toHaveBeenCalled(); expect(mocks.header).toHaveBeenCalledWith("Cache-Control", "no-store"); });
  it("transmet la session client aux lectures et modes, sans retourner delivery", async () => { mocks.invoice.mockResolvedValue({ id: "invoice", delivery: { password: "private" } }); const result = await read({ data: { id: "invoice" } }); expect(mocks.invoice).toHaveBeenCalledWith("test-customer-session", "invoice"); expect(mocks.methods).toHaveBeenCalledWith("test-customer-session"); expect(JSON.stringify(result)).not.toContain("private"); });
  it.each(["customer_unauthorized", "customer_session_expired"])("supprime la session sur 401 %s", async code => { mocks.invoice.mockRejectedValue(new HypertvError(401, code, "")); await expect(read({ data: { id: "invoice" } })).rejects.toThrow("Session expirée"); expect(mocks.clear).toHaveBeenCalled(); });
  it("bloque le paiement gratuit côté serveur", async () => { mocks.invoice.mockResolvedValue({ id: "invoice", payable: true, priceEur: 0 }); await expect(pay({ data: { id: "invoice", method: "stripe" } })).rejects.toThrow("ne peut pas être payée"); expect(mocks.pay).not.toHaveBeenCalled(); });
  it("bloque annulation source hypertv côté serveur", async () => { mocks.invoice.mockResolvedValue({ id: "invoice", source: "hypertv", state: "pending" }); await expect(cancel({ data: { id: "invoice" } })).rejects.toThrow("ne peut pas être annulée"); expect(mocks.cancel).not.toHaveBeenCalled(); });
  it("utilise order.id du paiement avec URL de retour de nouvelle facture", async () => { const result = await pay({ data: { id: "invoice", method: "stripe" } }); expect(result.id).toBe("new-invoice"); expect(mocks.stripe).toHaveBeenCalledWith("new-invoice", "https://shop.hypertv.win/mon-compte/factures/new-invoice", "test-customer-session"); });
  it("vérifie la facture avant d’envoyer le TXID à la commande autorisée", async () => { await paypal({ data: { id: "invoice", txid: "transaction", paypalEmail: "test@example.org" } }); expect(mocks.paypal).toHaveBeenCalledWith("owned-order", { txid: "transaction", paypalEmail: "test@example.org" }, "test-customer-session"); });
  it("déduit la taille des pages depuis la première et non la dernière", async () => { mocks.invoices.mockImplementation((_session, search) => Promise.resolve({ total: 25, page: search.page, invoices: Array.from({ length: search.page === 1 ? 20 : 5 }, (_, n) => ({ id: String(n) })) })); const result = await list({ data: { q: "", status: "", method: "", page: 2 } }); expect(result.pageSize).toBe(20); });
});