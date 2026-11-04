import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ reload: vi.fn(), create: vi.fn(), read: vi.fn(), send: vi.fn(), share: vi.fn(), draft: null as any }));
vi.mock("@/lib/invoices.functions", () => ({ getCustomerOrderTicket: mocks.reload }));
vi.mock("@/lib/support.functions", () => ({ createSupportTicket: mocks.create, getSupportTicket: mocks.read, sendSupportMessage: mocks.send }));
vi.mock("@/lib/support-client", () => ({ rememberTicketKey: vi.fn(), shareTicketKey: mocks.share }));
vi.mock("@/lib/support-crypto", () => ({
  newTicketKey: async () => ({ type: "secret" }),
  encryptJson: async (_key: unknown, value: unknown) => ({ ct: JSON.stringify(value) === '"Subject"' ? "encrypted-subject" : "encrypted-message", iv: "encrypted-iv" }),
  readOrderTicketDraft: async () => mocks.draft,
  saveOrderTicketDraft: async (_c: string, _o: string, draft: unknown) => { mocks.draft = draft; },
  deleteOrderTicketDraft: async () => { mocks.draft = null; },
}));
import { ensureCustomerOrderTicket } from "@/lib/order-ticket-client";
const ctx = { customerId: "customer", username: null, device: { deviceId: "device", privateKey: {} as CryptoKey, publicJwk: "public" } };
const order = { id: "free-lion", supportTicketRequired: true, suggestedTicket: { category: "subscription", subject: "Subject", message: "Private formula and price" } };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.draft = null; mocks.share.mockResolvedValue(undefined); mocks.read.mockResolvedValue({ notModified: false, ticket: { subject: { ct: "encrypted-subject", iv: "encrypted-iv" } }, devices: [], messages: [] }); });
describe("encrypted order ticket recovery", () => {
  it("sends encrypted subject and message for an immediately paid free order", async () => {
    mocks.reload.mockResolvedValueOnce(order).mockResolvedValueOnce({ ...order, supportTicketId: "ticket" });
    mocks.create.mockResolvedValue({ id: "ticket" }); mocks.send.mockResolvedValue({ ok: true });
    expect((await ensureCustomerOrderTicket(order, ctx)).supportTicketId).toBe("ticket");
    expect(mocks.create).toHaveBeenCalledWith({ data: { category: "subscription", subject: { ct: "encrypted-subject", iv: "encrypted-iv" }, orderId: "free-lion" } });
    expect(mocks.send).toHaveBeenCalledWith({ data: { id: "ticket", ct: "encrypted-message", iv: "encrypted-iv" } });
    expect(mocks.draft).toBeNull();
  });
  it("recovers a lost POST response after reload without another ticket", async () => {
    mocks.reload.mockResolvedValueOnce(order);
    mocks.create.mockRejectedValueOnce(new Error("response lost"));
    await ensureCustomerOrderTicket(order, ctx);
    expect(mocks.draft).not.toBeNull();
    mocks.reload.mockResolvedValue({ ...order, supportTicketRequired: false, supportTicketId: "already-created" });
    mocks.send.mockResolvedValue({ ok: true });
    await ensureCustomerOrderTicket(order, ctx);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith({ data: { id: "already-created", ct: "encrypted-message", iv: "encrypted-iv" } });
  });
  it("does not resend a message when only its response was lost", async () => {
    mocks.draft = { key: {}, category: "subscription", subject: { ct: "encrypted-subject", iv: "encrypted-iv" }, message: { ct: "encrypted-message", iv: "encrypted-iv" } };
    mocks.reload.mockResolvedValue({ ...order, supportTicketId: "ticket" });
    mocks.read.mockResolvedValue({ notModified: false, ticket: { subject: mocks.draft.subject }, devices: [], messages: [mocks.draft.message] });
    await ensureCustomerOrderTicket(order, ctx);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
});