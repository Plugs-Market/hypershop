// Suivi de livraison manuelle LION OTT : dès que la commande est payée, le ticket
// support chiffré est ouvert automatiquement (sujet + premier message suggérés par
// l'API) et le client est redirigé dessus. Aucun identifiant de ligne n'est affiché :
// la livraison se fait par le revendeur dans le ticket.
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, LifeBuoy, Loader2, LogIn, PackageOpen } from "lucide-react";
import { accountStatusQuery } from "@/lib/account.functions";
import { getLionDelivery } from "@/lib/shop.functions";
import { createSupportTicket, sendSupportMessage } from "@/lib/support.functions";
import { encryptJson, newTicketKey } from "@/lib/support-crypto";
import { rememberTicketKey, shareTicketKey, useSupportContext } from "@/lib/support-client";
import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/support";
import type { LionDelivery } from "@/lib/shop-order";
import { Button } from "@/components/ui/button";

const POLL_MS = 20_000;

export function LionDeliveryPanel({ orderId }: { orderId: string }) {
  const navigate = useNavigate();
  const fetchDelivery = useServerFn(getLionDelivery);
  const { data: status } = useQuery(accountStatusQuery);
  const loggedIn = status?.loggedIn === true;
  const { ctx } = useSupportContext();
  const [delivery, setDelivery] = useState<LionDelivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const creating = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await fetchDelivery({ data: { id: orderId } });
      if (r.delivery) {
        setDelivery(r.delivery);
        setError(null);
      } else if (r.error) {
        setError(r.error);
      }
    } catch {
      // Erreur réseau temporaire : le prochain cycle de polling réessaiera.
    }
  }, [fetchDelivery, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tant que la livraison n'est pas terminée, on relit le suivi toutes les 20 s.
  useEffect(() => {
    if (!delivery || delivery.status === "delivered" || (delivery.status === "awaiting_payment" && !delivery.supportTicketRequired)) return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [delivery, load]);

  // Ticket requis (aucun ticket lié) : création automatique une seule fois.
  // Verrou en mémoire + sessionStorage pour éviter les doublons (double rendu, rafraîchissement).
  useEffect(() => {
    if (!delivery || delivery.supportTicketId) return;
    const required = delivery.supportTicketRequired === true || delivery.status === "awaiting_ticket";
    if (!required || !loggedIn || !ctx || !delivery.suggestedTicket || creating.current) return;
    const lockKey = `lion-ticket:${orderId}`;
    try { if (sessionStorage.getItem(lockKey)) return; sessionStorage.setItem(lockKey, String(Date.now())); } catch { /* stockage indisponible */ }
    creating.current = true;
    const suggested = delivery.suggestedTicket;
    const category = (SUPPORT_CATEGORIES.some((c) => c.value === suggested.category) ? suggested.category : "subscription") as SupportCategory;
    (async () => {
      const key = await newTicketKey();
      const created = await createSupportTicket({ data: { category, subject: await encryptJson(key, suggested.subject), orderId } });
      rememberTicketKey(created.id, key);
      await shareTicketKey(created.id, key, created.devices, ctx.device, true);
      await sendSupportMessage({ data: { id: created.id, ...(await encryptJson(key, { t: suggested.message, ...(ctx.username ? { n: ctx.username } : {}) })) } });
      await load();
      await navigate({ to: "/mon-compte/support/$id", params: { id: created.id } });
    })().catch((e) => {
      creating.current = false;
      try { sessionStorage.removeItem(lockKey); } catch { /* ignore */ }
      setError(e instanceof Error ? e.message : "Création du ticket impossible. Réessayez.");
    });
  }, [delivery, loggedIn, ctx, orderId, navigate, load]);

  if (!delivery) {
    return (
      <div className="flex items-center gap-3 border-t border-border pt-5">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Chargement du suivi de livraison…</p>
          </>
        )}
      </div>
    );
  }

  if (delivery.status === "awaiting_payment" && !delivery.supportTicketId && !delivery.supportTicketRequired) return null;

  if (delivery.status === "awaiting_ticket" && !delivery.supportTicketId) {
    return (
      <div className="space-y-3 border-t border-border pt-5">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" />
          <p className="font-semibold">Paiement reçu, préparation de votre livraison…</p>
        </div>
        {!loggedIn && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-sm">Connectez-vous à votre compte boutique : votre livraison se fera dans un ticket support sécurisé.</p>
            <Button asChild variant="hero" className="mt-3 w-full">
              <Link to="/connexion">
                <LogIn className="h-4 w-4" /> Me connecter pour recevoir ma livraison
              </Link>
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (delivery.status === "delivered") {
    return (
      <div className="space-y-3 border-t border-border pt-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
          <p className="font-semibold">Livré ✅</p>
        </div>
        <p className="text-sm text-muted-foreground">Vos accès vous ont été transmis par votre revendeur dans le ticket support.</p>
        {delivery.supportTicketId && (
          <Button asChild variant="hero" className="w-full">
            <Link to="/mon-compte/support/$id" params={{ id: delivery.supportTicketId }}>
              <LifeBuoy className="h-4 w-4" /> Ouvrir le ticket
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <PackageOpen className="h-6 w-6 shrink-0 text-primary" />
        <p className="font-semibold">En attente de livraison par votre revendeur</p>
      </div>
      <p className="text-sm text-muted-foreground">Votre revendeur prépare vos accès et vous les transmet dans le ticket support sécurisé.</p>
      {delivery.supportTicketId && (
        <Button asChild variant="hero" className="w-full">
          <Link to="/mon-compte/support/$id" params={{ id: delivery.supportTicketId }}>
            <LifeBuoy className="h-4 w-4" /> Ouvrir le ticket
          </Link>
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
