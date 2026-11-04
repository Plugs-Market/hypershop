import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoice: vi.fn(), create: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (f: unknown) => f }), handler: (f: unknown) => f }) }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
vi.mock("@/lib/account.server", () => ({ readSession: () => "customer-session", clearSession: vi.fn() }));
vi.mock("@/lib/hypertvClient.server", () => ({ HypertvError: class extends Error {}, hypertv: { getInvoice: mocks.invoice, supportCreate: mocks.create } }));
import { createSupportTicket } from "@/lib/support.functions";
const create = createSupportTicket as unknown as (args: { data: { orderId: string; category: string; subject: { ct: string; iv: string } } }) => Promise<{ id: string }>;
const data = { orderId: "old-delivered", category: "subscription", subject: { ct: "encrypted", iv: "iv" } };
beforeEach(() => vi.clearAllMocks());
it("blocks an order-linked ticket on the server when already delivered, even if required is true", async () => {
  mocks.invoice.mockResolvedValue({ id: data.orderId, supportTicketRequired: true, delivery: { mode: "manual", status: "delivered" } });
  await expect(create({ data })).rejects.toThrow("déjà livrée");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("preserves an existing linked ticket for a delivered order", async () => {
  mocks.invoice.mockResolvedValue({ id: data.orderId, supportTicketRequired: true, supportTicketId: "existing-ticket", delivery: { status: "delivered" } });
  expect((await create({ data })).id).toBe("existing-ticket");
  expect(mocks.create).not.toHaveBeenCalled();
});