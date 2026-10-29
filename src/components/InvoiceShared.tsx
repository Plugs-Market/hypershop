import { useEffect, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { GuidesShell } from "./GuidesShell";
import { Button } from "./ui/button";
import { invoiceStatusLabels } from "@/lib/invoices";

export function InvoiceStatus({ state }: { state: string }) {
  const tone = ["paid", "activated"].includes(state) ? "bg-success/10 text-success" : ["pending", "detected", "review"].includes(state) ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${tone}`}>{invoiceStatusLabels[state] ?? "Indisponible"}</span>;
}
export function InvoiceError({ error }: { error: unknown }) {
  const navigate = useNavigate(), router = useRouter();
  const message = error instanceof Error ? error.message : "Factures momentanément indisponibles.";
  useEffect(() => { if (message.startsWith("Session expirée")) void navigate({ to: "/connexion", replace: true }); }, [message, navigate]);
  return <GuidesShell shop={null}><div role="alert" className="space-y-4 py-12 text-center"><h1 className="text-2xl font-bold">Mes factures</h1><p>{message}</p><Button onClick={() => router.invalidate()}>Réessayer</Button></div></GuidesShell>;
}
export function InvoiceNotFound() { return <GuidesShell shop={null}><h1 className="text-2xl font-bold">Facture introuvable</h1><InvoiceBack /></GuidesShell>; }
export function InvoiceBack() { return <Button variant="ghost" size="sm" asChild><Link to="/mon-compte/factures" search={{ status: "", method: "", q: "", page: 1 }}><ArrowLeft />Mes factures</Link></Button>; }
export function InvoiceCountdown({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const end = Date.parse(expiresAt ?? "");
  if (!Number.isFinite(end) || now === null) return null;
  const seconds = Math.max(0, Math.floor((end - now) / 1000));
  return <p className="text-sm text-muted-foreground" aria-live="off">{seconds === 0 ? "Délai de paiement expiré" : <>Expire dans <strong className="font-mono text-foreground">{Math.floor(seconds / 3600)} h {String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")} min {String(seconds % 60).padStart(2, "0")} s</strong></>}</p>;
}