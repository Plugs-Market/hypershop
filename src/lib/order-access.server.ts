import { getCookie, setCookie, getRequestUrl } from "@tanstack/react-start/server";
import { createServerOnlyFn } from "@tanstack/react-start";

export async function hashValue(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export const ownerHash = createServerOnlyFn(async (create = false) => {
  let token = getCookie("shop-owner");
  if (!token && create) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
    setCookie("shop-owner", token, { httpOnly: true, secure: new URL(getRequestUrl()).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return token && /^[a-f0-9]{64}$/.test(token) ? hashValue(token) : null;
});
export const ownsOrder = createServerOnlyFn(async (id: string) => {
  const hash = await ownerHash();
  if (!hash) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("shop_order_access").select("owner_hash").eq("order_id", id).maybeSingle();
  return !error && data?.owner_hash === hash;
});