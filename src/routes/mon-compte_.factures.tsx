import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownWideNarrow, ArrowLeft, ChevronLeft, ChevronRight, Receipt, Search } from "lucide-react";
import { listCustomerInvoices } from "@/lib/invoices.functions";
import { invoiceSearchSchema, INVOICE_STATES, invoiceStatusLabels, invoiceCurrency, newestInvoices, type InvoiceSearch } from "@/lib/invoices";
import { formatFrDate } from "@/lib/account";
import { shopQuery } from "./mon-compte";
import { GuidesShell } from "@/components/GuidesShell";
import { InvoiceStatus, InvoiceError, InvoiceNotFound } from "@/components/InvoiceShared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const invoicesQuery = (search: InvoiceSearch) => queryOptions({ queryKey: ["customer-invoices", search], queryFn: () => listCustomerInvoices({ data: search }), staleTime: 0, gcTime: 0, retry: false });
export const Route = createFileRoute("/mon-compte_/factures")({
  validateSearch: (s) => invoiceSearchSchema.parse(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    try {
      const [, shop] = await Promise.all([context.queryClient.ensureQueryData(invoicesQuery(deps)), context.queryClient.ensureQueryData(shopQuery)]);
      return { shopName: shop.name };
    } catch (e) { if (e instanceof Error && e.message.startsWith("Session expirée")) throw redirect({ to: "/connexion" }); throw e; }
  },
  head: ({ loaderData }) => {
    const title = `Mes factures — ${loaderData?.shopName ?? "Boutique"}`, description = "Consultez vos factures et suivez vos paiements dans votre espace client HyperTV.";
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] };
  },
  component: InvoicesPage, errorComponent: InvoiceError, notFoundComponent: InvoiceNotFound,
});
function InvoicesPage() {
  const search = Route.useSearch(), navigate = useNavigate();
  const { data } = useSuspenseQuery(invoicesQuery(search)), { data: shop } = useSuspenseQuery(shopQuery);
  const [draft, setDraft] = useState(search.q);
  const change = (patch: Partial<InvoiceSearch>) => navigate({ to: "/mon-compte/factures", search: { ...search, page: 1, ...patch } });
  const count = data.invoices.length;
  const more = data.pageSize ? data.page * data.pageSize < data.total : count > 0 && (data.page === 1 ? count < data.total : count * data.page < data.total);
  return <GuidesShell shop={shop}><div className="mx-auto max-w-4xl space-y-6">
    <Button variant="ghost" size="sm" asChild><Link to="/mon-compte"><ArrowLeft />Mon compte</Link></Button>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-3 text-2xl font-bold"><Receipt className="text-primary" />Mes factures</h1><span className="text-sm text-muted-foreground">{data.total} facture{data.total !== 1 ? "s" : ""}</span></div>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void change({ q: draft }); }}><Input aria-label="Rechercher une facture" placeholder="Rechercher une facture…" value={draft} maxLength={200} onChange={e => setDraft(e.target.value)} /><Button type="submit" size="icon" aria-label="Rechercher" title="Rechercher"><Search /></Button></form>
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtres de factures">
      <label className="sr-only" htmlFor="filter-status">Filtrer par état</label>
      <Select value={search.status} onValueChange={(v) => change({ status: v })}>
        <SelectTrigger id="filter-status" size="sm" className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="">Tous les états</SelectItem>
          {INVOICE_STATES.filter(s => s !== "activated").map(s => <SelectItem key={s} value={s}>{invoiceStatusLabels[s]}</SelectItem>)}
        </SelectContent>
      </Select>
      <label className="sr-only" htmlFor="filter-method">Filtrer par mode de paiement</label>
      <Select value={search.method} onValueChange={(v) => change({ method: v })}>
        <SelectTrigger id="filter-method" size="sm" className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="">Tous les modes</SelectItem>
          {data.methods.map(m => <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <p className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowDownWideNarrow className="h-4 w-4" />Plus récentes</p>
    {count === 0 ? <p className="border-y border-border py-12 text-center text-muted-foreground">Aucune facture trouvée.</p> : <div className="grid gap-4 sm:grid-cols-2">{newestInvoices(data.invoices).map(i => <article key={i.id} className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">N° {i.number}</span><InvoiceStatus state={i.state} /></div><h2 className="break-words text-lg font-semibold">{i.plan}</h2><p className="text-sm text-muted-foreground">{formatFrDate(i.createdAt)} · {i.payment.label}</p><div className="flex flex-wrap items-center justify-between gap-3"><strong className="text-xl">{invoiceCurrency(i.priceEur)}</strong>{i.source === "hypertv" && <span className="rounded-md bg-muted px-2 py-1 text-xs">HyperTV · Lecture seule</span>}</div><Button variant="outline" asChild className="w-full"><Link to="/mon-compte/factures/$id" params={{ id: i.id }}>Voir la facture<ChevronRight /></Link></Button>
    </article>)}</div>}
    <nav className="flex items-center justify-center gap-4" aria-label="Pagination"><Button variant="outline" size="icon" title="Page précédente" aria-label="Page précédente" disabled={data.page <= 1} onClick={() => change({ page: data.page - 1 })}><ChevronLeft /></Button><span className="text-sm">Page {data.page}</span><Button variant="outline" size="icon" title="Page suivante" aria-label="Page suivante" disabled={!more} onClick={() => change({ page: data.page + 1 })}><ChevronRight /></Button></nav>
  </div></GuidesShell>;
}