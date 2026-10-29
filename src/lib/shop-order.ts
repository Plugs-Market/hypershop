import { z } from "zod";
import { MAC_REGEX, normalizeMac, translateHypertvError } from "./hypertv-shared";

const commonFields = {
  mac: z.string().transform(normalizeMac).refine((mac) => MAC_REGEX.test(mac), "Adresse MAC invalide"),
  // Absent pour une formule gratuite : l'API ne propose aucun mode de paiement.
  method: z.string().min(1).max(50).optional(),
  idempotencyKey: z.string().uuid(),
};
// strict empêche toute combinaison des deux identifiants ou tout prix envoyé par le navigateur.
export const orderInputSchema = z.union([
  z.object({ ...commonFields, planId: z.string().min(1).max(100) }).strict(),
  z.object({ ...commonFields, trexPlanId: z.string().min(1).max(100) }).strict(),
]);
export type OrderInput = z.infer<typeof orderInputSchema>;

export type OrderAttempt = { signature: string; key: string };
export function resolveOrderAttempt(previous: OrderAttempt | null, signature: string, generateKey: () => string): OrderAttempt {
  return previous?.signature === signature ? previous : { signature, key: generateKey() };
}

export type OrderProgress = {
  state: string;
  type?: string;
  activationError?: string | null;
  steps?: { trexLine: boolean; playlist: boolean; subscription: "done" | null } | null;
  includesHypertvSubscription?: null | { name: string; durationDays: number; maxDevices: number };
};

export function activationNotice(order: OrderProgress): string | null {
  if (order.state === "activated") return null;
  if (order.activationError === "trex_line_state_unknown_contact_support" || order.state === "trex_line_state_unknown_contact_support") {
    return translateHypertvError(0, "trex_line_state_unknown_contact_support");
  }
  if (order.state === "paid_activation_failed" || order.activationError === "Crédits HyperTV insuffisants." || order.activationError?.startsWith("trex_")) {
    return translateHypertvError(0, "paid_activation_failed");
  }
  return null;
}

export function shouldPollOrder(order: OrderProgress): boolean {
  if (["activated", "expired", "cancelled"].includes(order.state)) return false;
  return ["pending", "detected", "review", "paid", "paid_activation_failed"].includes(order.state) || activationNotice(order) !== null;
}

export function trexTimeline(order: OrderProgress) {
  const activated = order.state === "activated";
  const result = [
    { label: "Paiement", done: activated || ["paid", "paid_activation_failed"].includes(order.state) || activationNotice(order) !== null || order.steps?.trexLine === true },
    { label: "Ligne TREX créée", done: activated || order.steps?.trexLine === true },
    { label: "Playlist ajoutée dans l'app HyperTV", done: activated || order.steps?.playlist === true },
  ];
  // null signifie qu'aucune prolongation n'est incluse ; "done" suffit aussi à identifier une inclusion.
  if (order.includesHypertvSubscription || order.steps?.subscription === "done") {
    result.push({ label: "Abonnement HyperTV prolongé", done: activated || order.steps?.subscription === "done" });
  }
  return result;
}