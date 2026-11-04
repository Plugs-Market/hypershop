import { describe, expect, it, vi } from "vitest";
import { ensureOrderTicket, type TicketOrder } from "@/lib/order-ticket";
const suggestedTicket = { category: "subscription", subject: "Commande", message: "Formule et prix" };
const lock = async <T>(_id: string, run: () => Promise<T>) => run();
describe("automatic encrypted order tickets", () => {
  it.each(["lion-free", "lion-paid", "trex-paid_activation_failed", "old-account-order"])("creates and reloads %s", async id => {
    let order: TicketOrder = { id, supportTicketRequired: true, suggestedTicket };
    const create = vi.fn(async () => { order = { ...order, supportTicketRequired: false, supportTicketId: "ticket-1" }; });
    expect((await ensureOrderTicket(order, { lock, create, reload: async () => order })).supportTicketId).toBe("ticket-1");
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("does nothing when a ticket exists or is not required", async () => {
    const create = vi.fn();
    for (const order of [{ id: "exists", supportTicketRequired: true, supportTicketId: "ticket" }, { id: "not-required", supportTicketRequired: false }]) {
      await ensureOrderTicket(order, { lock, create, reload: async () => order });
    }
    expect(create).not.toHaveBeenCalled();
  });
  it("coalesces concurrent calls and rereads the linked ticket on reload", async () => {
    let order: TicketOrder = { id: "concurrent", supportTicketRequired: true, suggestedTicket };
    const create = vi.fn(async () => { await Promise.resolve(); order = { ...order, supportTicketId: "one" }; });
    const deps = { lock, create, reload: async () => order };
    await Promise.all([ensureOrderTicket(order, deps), ensureOrderTicket(order, deps)]);
    await ensureOrderTicket({ id: "concurrent", supportTicketRequired: true }, deps);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("retries after a network failure instead of retaining a permanent lock", async () => {
    const order: TicketOrder = { id: "retry", supportTicketRequired: true, suggestedTicket };
    const create = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(undefined);
    const deps = { lock, create, reload: async () => order };
    await ensureOrderTicket(order, deps);
    await ensureOrderTicket(order, deps);
    expect(create).toHaveBeenCalledTimes(2);
  });
});