import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ensureCustomerOrderTicket } from "@/lib/order-ticket-client";
import type { TicketOrder } from "@/lib/order-ticket";
import { listCustomerInvoices } from "@/lib/invoices.functions";
import { useSupportContext } from "@/lib/support-client";

export function useOrderTickets(orders: TicketOrder[], onUpdated?: (order: TicketOrder) => void, scanAccount = false) {
  const { ctx } = useSupportContext();
  const qc = useQueryClient();
  const [opening, setOpening] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!ctx) return;
    let alive = true;
    const process = async (order: TicketOrder) => {
      if (alive && order.supportTicketRequired && !order.supportTicketId) setOpening(prev => new Set(prev).add(order.id));
      try {
        const next = await ensureCustomerOrderTicket(order, ctx);
        if (!alive) return;
        onUpdated?.(next);
        if (next.supportTicketId && next.supportTicketId !== order.supportTicketId) {
          await Promise.all([qc.invalidateQueries({ queryKey: ["customer-invoices"] }), qc.invalidateQueries({ queryKey: ["customer-invoice"] })]);
        }
      } finally {
        if (alive) setOpening(prev => { const next = new Set(prev); next.delete(order.id); return next; });
      }
    };
    const run = async () => {
      for (const order of orders) { if (!alive) return; await process(order); }
      if (!scanAccount) return;
      let page = 1, seen = 0;
      while (alive) {
        const result = await listCustomerInvoices({ data: { status: "", method: "", q: "", page } });
        for (const invoice of result.invoices) {
          if (!alive) return;
          if (invoice.orderId) await process({ ...invoice, id: invoice.orderId });
        }
        seen += result.invoices.length;
        if (!result.invoices.length || seen >= result.total) break;
        page++;
      }
    };
    void run().catch(() => null); // Do not block account/checkout when the network fails.
    return () => { alive = false; };
  }, [ctx, orders, onUpdated, scanAccount, qc]);
  return opening;
}