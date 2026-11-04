import { ensureOrderTicket, type TicketOrder } from "./order-ticket";
import { getCustomerOrderTicket } from "./invoices.functions";
import { createSupportTicket, getSupportTicket, sendSupportMessage } from "./support.functions";
import { encryptJson, newTicketKey, readOrderTicketDraft, saveOrderTicketDraft, deleteOrderTicketDraft } from "./support-crypto";
import { rememberTicketKey, shareTicketKey, type SupportContext } from "./support-client";

async function withOrderLock<T>(id: string, run: () => Promise<T>): Promise<T> {
  const acquire = async () => {
    const key = `order-ticket-lock:${id}`;
    const token = crypto.randomUUID();
    const read = (): { token: string; until: number } | null => {
      try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
    };
    const write = () => { try { localStorage.setItem(key, JSON.stringify({ token, until: Date.now() + 45_000 })); } catch { /* Web Locks still protect when storage is disabled */ } };
    const current = read();
    if (!navigator.locks && current && current.until > Date.now()) throw new Error("Ticket en cours");
    write();
    const check = read();
    if (check && check.token !== token) throw new Error("Ticket en cours");
    const heartbeat = setInterval(write, 10_000);
    try { return await run(); }
    finally { clearInterval(heartbeat); try { if (read()?.token === token) localStorage.removeItem(key); } catch { /* ignore */ } }
  };
  return navigator.locks ? navigator.locks.request(`order-ticket:${id}`, acquire) : acquire();
}

export async function ensureCustomerOrderTicket(order: TicketOrder, ctx: SupportContext): Promise<TicketOrder> {
  const reload = () => getCustomerOrderTicket({ data: { id: order.id } });
  const create = async (fresh: TicketOrder) => {
    let draft = await readOrderTicketDraft(ctx.customerId, order.id);
    if (!draft) {
      if (!fresh.suggestedTicket) return;
      const key = await newTicketKey();
      draft = { key, category: fresh.suggestedTicket.category, subject: await encryptJson(key, fresh.suggestedTicket.subject), message: await encryptJson(key, { t: fresh.suggestedTicket.message, ...(ctx.username ? { n: ctx.username } : {}) }) };
      // Saved before POST, so a lost response does not lose the key.
      await saveOrderTicketDraft(ctx.customerId, order.id, draft);
    }
    const ticketId = fresh.supportTicketId ?? (await createSupportTicket({ data: { category: draft.category, subject: draft.subject, orderId: order.id } })).id;
    const detail = await getSupportTicket({ data: { id: ticketId, deviceId: ctx.device.deviceId, includeDevices: true } });
    if (detail.notModified) throw new Error("Ticket indisponible");
    if (detail.ticket.subject?.ct !== draft.subject.ct || detail.ticket.subject.iv !== draft.subject.iv) {
      await deleteOrderTicketDraft(ctx.customerId, order.id);
      return;
    }
    rememberTicketKey(ticketId, draft.key);
    await shareTicketKey(ticketId, draft.key, detail.devices, ctx.device, true);
    // Reuse exactly the same ciphertext on retry and confirm whether it was already sent.
    if (!detail.messages.some(m => m.ct === draft.message.ct && m.iv === draft.message.iv)) {
      await sendSupportMessage({ data: { id: ticketId, ...draft.message } });
    }
    await deleteOrderTicketDraft(ctx.customerId, order.id);
  };
  // Complete keys/message after a refresh interrupted an already-linked ticket.
  try {
    if (await readOrderTicketDraft(ctx.customerId, order.id)) {
      return await withOrderLock(order.id, async () => { const fresh = await reload(); await create(fresh); return reload(); });
    }
  } catch { return order; }
  return ensureOrderTicket(order, { reload, create, lock: withOrderLock });
}