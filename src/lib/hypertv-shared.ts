// Client-safe helpers shared by server and UI.
export const MAC_REGEX = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;

export function normalizeMac(input: string): string {
  return input.trim().toUpperCase().replace(/-/g, ":");
}

export function isValidMac(input: string): boolean {
  return MAC_REGEX.test(normalizeMac(input));
}

// Traduction des codes d'erreur de l'API revendeur HyperTV.
export function translateHypertvError(status: number, code?: string, message?: string): string {
  if (status === 401 || status === 403) return "Boutique temporairement indisponible.";
  switch (code) {
    case "invalid_request":
      return "Vérifiez la MAC et l'email.";
    case "customer_not_found":
      return "Aucun compte HyperTV avec cette adresse MAC";
    case "customer_locked_to_other_reseller":
      return "Ce compte est géré par un autre revendeur";
    case "plan_not_for_sale":
      return "Cette formule n'est plus disponible";
    case "trex_unavailable":
      return "Formule temporairement indisponible";
    case "trex_line_state_unknown_contact_support":
      return "Paiement reçu, notre équipe finalise votre activation";
    case "paid_activation_failed":
      return "Paiement reçu, activation en cours de traitement : nous vous contactons rapidement";
    case "payment_method_unavailable":
      return "Mode de paiement indisponible.";
    case "order_not_payable":
      return "Cette commande ne peut plus être payée.";
    case "txid_already_used":
      return "Cet ID de transaction a déjà été utilisé.";
    case "invalid_txid":
      return "ID de transaction invalide.";
    case "unauthorized":
    case "shop_not_active":
    case "origin_not_allowed":
      return "Boutique temporairement indisponible.";
    case "network_error":
      return "Le service ne répond pas. Nouvel essai dans quelques instants.";
    case "timeout":
      return "Le service a mis trop de temps à répondre. Nouvel essai dans quelques instants.";
  }
  if (message === "Crédits HyperTV insuffisants." || message?.startsWith("trex_")) {
    return "Paiement reçu, activation en cours de traitement : nous vous contactons rapidement";
  }
  if (status === 422) return message || "Demande refusée.";
  return "Une erreur inattendue est survenue. Réessayez plus tard.";
}

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function formatEur(eur: number): string {
  return eur.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
