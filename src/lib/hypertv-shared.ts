// Client-safe helpers shared by server and UI.
export const MAC_REGEX = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;

export function normalizeMac(input: string): string {
  return input.trim().toUpperCase().replace(/-/g, ":");
}

export function isValidMac(input: string): boolean {
  return MAC_REGEX.test(normalizeMac(input));
}

export function translateHypertvError(status: number, code?: string, message?: string): string {
  switch (code) {
    case "invalid_request":
      return "Les informations envoyées sont invalides. Vérifiez l'adresse MAC et la formule.";
    case "unauthorized":
      return "La boutique n'est pas autorisée auprès d'HyperTV. Contactez le vendeur.";
    case "shop_not_active":
      return "La boutique est temporairement inactive. Contactez le vendeur.";
    case "origin_not_allowed":
      return "Cette boutique n'est pas autorisée à activer des abonnements. Contactez le vendeur.";
    case "customer_locked_to_other_reseller":
      return "Cet appareil est déjà rattaché à un autre revendeur. Contactez le vendeur.";
    case "customer_not_found":
      return "Appareil introuvable. Ouvrez l'app HyperTV une première fois puis vérifiez l'adresse MAC.";
    case "in_progress":
      return "Activation en cours de traitement. Nouvel essai dans quelques instants.";
    case "network_error":
      return "Le service d'activation ne répond pas. Nouvel essai dans quelques instants.";
    case "timeout":
      return "Le service d'activation a mis trop de temps à répondre. Nouvel essai dans quelques instants.";
  }
  if (status === 422) {
    const m = (message || "").toLowerCase();
    if (m.includes("crédit") || m.includes("credit"))
      return "Activation momentanément impossible (stock revendeur insuffisant). Le vendeur a été prévenu.";
    if (m.includes("formule") || m.includes("plan")) return "Cette formule n'est plus disponible.";
    return message || "Activation refusée.";
  }
  return "Une erreur inattendue est survenue. Réessayez plus tard.";
}

export function isRetryableCode(code?: string): boolean {
  return code === "in_progress" || code === "network_error" || code === "timeout";
}

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
