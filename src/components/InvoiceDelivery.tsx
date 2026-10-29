import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { getCustomerInvoiceDelivery } from "@/lib/invoices.functions";
import type { Delivery } from "@/lib/playlist-security";
import { PrivateField } from "./OrderDelivery";
import { Button } from "./ui/button";

export function InvoiceDelivery({ id }: { id: string }) {
  const read = useServerFn(getCustomerInvoiceDelivery), navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { setDelivery(null); setError(null); }, [id]);
  async function show() {
    setBusy(true); setError(null);
    try { setDelivery(await read({ data: { id } })); }
    catch (e) { const message = e instanceof Error ? e.message : "Accès momentanément indisponibles."; if (message.startsWith("Session expirée")) { setDelivery(null); void navigate({ to: "/connexion", replace: true }); } else setError(message); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t border-border pt-6"><h2 className="text-xl font-semibold">Ma ligne IPTV</h2>{!delivery ? <Button variant="outline" disabled={busy} onClick={show}>{busy ? "Récupération…" : "Afficher mes accès"}</Button> : <>
    {delivery.expiresAt && <p className="text-sm text-muted-foreground">Ligne valable jusqu’au {new Date(delivery.expiresAt).toLocaleDateString("fr-FR")}</p>}<PrivateField label="Lien M3U" value={delivery.m3uUrl} /><h3 className="font-semibold">Xtream Codes</h3><PrivateField label="Serveur" value={delivery.xtream.serverUrl} /><PrivateField label="Identifiant" value={delivery.xtream.username} /><PrivateField label="Mot de passe" value={delivery.xtream.password} secret /><Button variant="ghost" onClick={() => setDelivery(null)}>Masquer mes accès</Button>
  </>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</section>;
}