// Helpers client-safe de l'espace client.
import { z } from "zod";

export function normalizeAccessKey(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
  return raw.match(/.{1,5}/g)?.join("-") ?? "";
}
export const ACCESS_KEY_REGEX = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;

export const usernameSchema = z
  .string()
  .trim()
  .min(2, "2 caractères minimum")
  .max(30, "30 caractères maximum")
  .regex(/^[\p{L}\p{N} _.-]+$/u, "Lettres, chiffres, espace, _ . - uniquement");

export const SESSION_ERRORS = ["customer_unauthorized", "customer_session_expired"];

export function translateAccountError(code?: string): string {
  switch (code) {
    case "invalid_key": return "Clé inconnue";
    case "invalid_code": return "Code incorrect";
    case "mfa_token_invalid": return "Délai dépassé, recommencez";
    case "too_many_attempts": return "Trop de tentatives, réessayez plus tard";
    case "customer_unauthorized":
    case "customer_session_expired": return "Session expirée, reconnectez-vous";
    case "invalid_username":
    case "invalid_request": return "Pseudo invalide";
    case "timeout":
    case "network_error": return "Le service ne répond pas. Réessayez dans quelques instants.";
  }
  return "Une erreur inattendue est survenue. Réessayez plus tard.";
}

export type CustomerAccount = {
  username: string | null;
  grade: string | null;
  createdAt: string | null;
  subscription: { active: boolean; expiresAt: string | null };
  playlistsCount: number;
  mac: string | null;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

// Accepte { account: … } ou la réponse directe, et des noms de champs proches.
export function normalizeAccount(json: unknown): CustomerAccount {
  const root = (json ?? {}) as Record<string, any>;
  const a = (root["account"] ?? root["customer"] ?? root) as Record<string, any>;
  const sub = (a["subscription"] ?? {}) as Record<string, any>;
  const playlists = a["playlistsCount"] ?? a["playlistCount"] ?? a["playlists"];
  return {
    username: str(a["username"]),
    grade: str(a["grade"]) ?? str(a["grade"]?.name) ?? str(a["rank"]),
    createdAt: str(a["createdAt"]) ?? str(a["created_at"]) ?? str(a["registeredAt"]),
    subscription: {
      active: sub["active"] === true,
      expiresAt: str(sub["expiresAt"]) ?? str(sub["expires_at"]),
    },
    playlistsCount: Array.isArray(playlists) ? playlists.length : typeof playlists === "number" ? playlists : 0,
    mac: str(a["mac"]) ?? str(a["magMac"]) ?? str(a["mag_mac"]) ?? str(a["mag"]?.mac),
  };
}

export function formatFrDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
