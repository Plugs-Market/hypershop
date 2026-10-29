import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CreditCard, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getCustomerInvoice, payCustomerInvoice, cancelCustomerInvoice, invoiceStripeCheckout, invoicePaypalTxid } from "@/lib/invoices.functions";
import { invoiceCanPay, invoiceCanCancel, invoiceCurrency, invoicePolls } from "@/lib/invoices";
import { formatFrDate } from "@/lib/account";
import { shopQuery } from "./mon-compte";
import { GuidesShell } from "@/components/GuidesShell";
import { InvoiceBack, InvoiceStatus, InvoiceError, InvoiceNotFound, InvoiceCountdown } from "@/components/InvoiceShared";
import { InvoiceDelivery } from "@/components/InvoiceDelivery";
import { PrivateField } from "@/components/OrderDelivery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

const detailQuery = (id: string) => queryOptions({ queryKey: ["customer-invoice", id], queryFn: () => getCustomerInvoice({ data: { id } }), staleTime: 0, gcTime: 0, retry: false, refetchInterval: query => invoicePolls(query.state.data?.invoice.state ?? "") ? 20_000 : false });
export const Route = createFileRoute("/mon-compte_/factures_/$id")({
  loader: async ({ context, params }) => {
    try { const [, shop] = await Promise.all([context.queryClient.ensureQueryData(detailQuery(params.id)), context.queryClient.ensureQueryData(shopQuery)]); return { shopName: shop.name }; }
    catch (e) { if (e instanceof Error && e.message.startsWith("Session expirée")) throw redirect({ to: "/connexion" }); throw e; }
  },
  head: ({ loaderData }) => { const title = `Détail de facture — ${loaderData?.shopName ?? "Boutique"}`, description = "Suivez votre facture et consultez vos informations de paiement dans votre espace client HyperTV."; return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }; },
  component: InvoicePage, errorComponent: InvoiceError, notFoundComponent: InvoiceNotFound,
});
function InvoicePage() {
  const { id } = Route.useParams(), navigate = useNavigate(), qc = useQueryClient();
  const { data } = useSuspenseQuery(detailQuery(id)), { data: shop } = useSuspenseQuery(shopQuery);
  const i = data.invoice, p = i.payment;
  const pay = useServerFn(payCustomerInvoice), cancel = useServerFn(cancelCustomerInvoice), stripe = useServerFn(invoiceStripeCheckout), paypal = useServerFn(invoicePaypalTxid);
  const [txid, setTxid] = useState(""), [email, setEmail] = useState(""), [notice, setNotice] = useState<string | null>(null);
  function onError(e: Error) { if (e.message.startsWith("Session expirée")) { qc.removeQueries({ queryKey: ["customer-invoices"] }); qc.removeQueries({ queryKey: ["customer-invoice"] }); void navigate({ to: "/connexion", replace: true }); } }
  async function refresh() { await Promise.all([qc.invalidateQueries({ queryKey: ["customer-invoice", id] }), qc.invalidateQueries({ queryKey: ["customer-invoices"] })]); }
  const payment = useMutation({ mutationFn: (method: string) => pay({ data: { id, method } }), onError, onSuccess: async r => { if (r.url) { window.location.assign(r.url); return; } if (r.id !== id) await navigate({ to: "/mon-compte/factures/$id", params: { id: r.id }, replace: true }); else await refresh(); } });
  const cancellation = useMutation({ mutationFn: () => cancel({ data: { id } }), onError, onSuccess: refresh });
  const card = useMutation({ mutationFn: () => stripe({ data: { id } }), onError, onSuccess: r => window.location.assign(r.url) });
  const declaration = useMutation({ mutationFn: () => paypal({ data: { id, txid, paypalEmail: email } }), onError, onSuccess: async () => { setNotice("Votre paiement est en cours de vérification."); setTxid(""); setEmail(""); await refresh(); } });
  const busy = payment.isPending || cancellation.isPending || card.isPending || declaration.isPending;
  const error = payment.error ?? cancellation.error ?? card.error ?? declaration.error;
  const mutable = i.source !== "hypertv" && i.priceEur > 0 && invoicePolls(i.state);
  return <GuidesShell shop={shop}><div className="mx-auto max-w-2xl space-y-6"><InvoiceBack />
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="break-all text-2xl font-bold">Facture N° {i.number}</h1><InvoiceStatus state={i.state} /></div>
    <div className="space-y-2 border-y border-border py-6"><h2 className="break-words text-xl font-semibold">{i.plan}</h2><p className="text-sm text-muted-foreground">{formatFrDate(i.createdAt)} · {p.label}</p><p className="text-3xl font-bold">{invoiceCurrency(i.priceEur)}</p>{i.source === "hypertv" && <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs">HyperTV · Lecture seule</span>}</div>
    {i.priceEur > 0 && p.address && p.method !== "paypal_ff" && p.method !== "stripe" && <section className="space-y-4"><h2 className="text-xl font-semibold">Paiement {p.label}</h2><p className="text-2xl font-bold">{p.amount} {p.symbol}</p><PrivateField label="Adresse de paiement" value={p.address} /><div className="flex justify-center"><div className="rounded-lg bg-qr-surface p-4"><QRCodeSVG value={p.address} size={180} /></div></div>{p.memo && <PrivateField label="Mémo / commentaire" value={p.memo} />}{invoicePolls(i.state) && <InvoiceCountdown expiresAt={i.expiresAt} />}</section>}
    {invoiceCanPay(i) && <section className="space-y-3 border-t border-border pt-6"><h2 className="text-xl font-semibold">Choisir un mode de paiement</h2><div className="grid gap-2 sm:grid-cols-2">{data.methods.map(m => <Button key={m.code} variant="outline" className="h-auto min-h-10 whitespace-normal py-3" disabled={busy || (m.minEur != null && i.priceEur < m.minEur) || (m.maxEur != null && i.priceEur > m.maxEur)} onClick={() => payment.mutate(m.code)}>{m.code === "stripe" && <CreditCard />}{m.label}</Button>)}</div></section>}
    {mutable && p.method === "stripe" && i.orderId && <Button className="w-full" disabled={busy} onClick={() => card.mutate()}><CreditCard />{card.isPending ? "Redirection…" : "Payer par carte"}</Button>}
    {mutable && p.method === "paypal_ff" && <section className="space-y-4 border-t border-border pt-6"><h2 className="text-xl font-semibold">Paiement PayPal</h2>{p.address && <PrivateField label="Adresse PayPal" value={p.address} />}{p.memo && <PrivateField label="Note de paiement" value={p.memo} />}{data.methods.find(m => m.code === p.method)?.instructions && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.methods.find(m => m.code === p.method)?.instructions}</p>}{i.orderId && !notice && <form className="space-y-3" onSubmit={e => { e.preventDefault(); declaration.mutate(); }}><div className="space-y-1"><Label htmlFor="invoice-txid">ID de transaction (TXID)</Label><Input id="invoice-txid" value={txid} minLength={4} maxLength={100} onChange={e => setTxid(e.target.value)} required /></div><div className="space-y-1"><Label htmlFor="invoice-email">Email PayPal</Label><Input id="invoice-email" type="email" value={email} maxLength={255} onChange={e => setEmail(e.target.value)} required /></div><Button disabled={busy} type="submit">{declaration.isPending ? "Envoi…" : "Déclarer mon paiement"}</Button></form>}</section>}
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}{error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
    {i.hasDelivery && <InvoiceDelivery key={id} id={id} />}
    {invoiceCanCancel(i) && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={busy}><X />Annuler la facture</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Annuler cette facture ?</AlertDialogTitle><AlertDialogDescription>La facture sera annulée. Confirmez uniquement si vous n'avez pas effectué le paiement.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Conserver la facture</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => cancellation.mutate()}>Confirmer l'annulation</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
  </div></GuidesShell>;
}