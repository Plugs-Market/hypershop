export type SuggestedTicket = { category: string; subject: string; message: string };
export type TicketOrder = {
  id: string;
  supportTicketRequired?: boolean;
  supportTicketId?: string | null | undefined;
  suggestedTicket?: SuggestedTicket | null;
  state?: string;
  deliveryStatus?: string | null;
  manualDeliveryStatus?: string | null;
  delivery?: { status?: string } | null;
};
export type TicketDependencies = {
  reload: () => Promise<TicketOrder>;
  create: (order: TicketOrder) => Promise<void>;
  lock: <T>(id: string, run: () => Promise<T>) => Promise<T>;
};
const pending = new Map<string, Promise<TicketOrder>>();

export function isOrderDelivered(order: Omit<TicketOrder, "id">): boolean {
  return order.delivery?.status === "delivered" || order.deliveryStatus === "delivered" || order.manualDeliveryStatus === "delivered" || order.state === "delivered";
}

// One coordinator for checkout, tracking and all account reads.
export function ensureOrderTicket(order: TicketOrder, deps: TicketDependencies): Promise<TicketOrder> {
  if (isOrderDelivered(order)) return Promise.resolve(order);
  const existing = pending.get(order.id);
  if (existing) return existing;
  if (order.supportTicketId || order.supportTicketRequired !== true) return Promise.resolve(order);
  const attempt = deps.lock(order.id, async () => {
    // Always reread after acquiring the lock: another tab/previous page may have created it.
    const fresh = await deps.reload();
    if (isOrderDelivered(fresh) || fresh.supportTicketId || fresh.supportTicketRequired !== true || !fresh.suggestedTicket) return fresh;
    await deps.create(fresh);
    return deps.reload();
  }).catch(() => order).finally(() => pending.delete(order.id));
  pending.set(order.id, attempt);
  return attempt;
}