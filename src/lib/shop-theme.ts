// Palette revendeur : validation stricte puis reconstruction du CSS (jamais injecté tel quel).
export type ShopTheme = {
  background: string; foreground: string; card: string; primary: string;
  primaryForeground: string; primaryGlow: string; muted: string; border: string;
  success: string; warning: string; destructive: string;
};

const HEX = /^#[0-9a-f]{6}$/i;
const KEYS: (keyof ShopTheme)[] = ["background", "foreground", "card", "primary", "primaryForeground", "primaryGlow", "muted", "border", "success", "warning", "destructive"];

export function validTheme(t: unknown): ShopTheme | null {
  if (!t || typeof t !== "object") return null;
  const o = t as Record<string, unknown>;
  for (const k of KEYS) if (typeof o[k] !== "string" || !HEX.test(o[k] as string)) return null;
  return o as ShopTheme;
}

export function buildThemeCss(t: unknown): string | null {
  const v = validTheme(t);
  if (!v) return null;
  const vars: Record<string, string> = {
    background: v.background, foreground: v.foreground,
    card: v.card, "card-foreground": v.foreground,
    popover: v.card, "popover-foreground": v.foreground,
    primary: v.primary, "primary-foreground": v.primaryForeground, "primary-glow": v.primaryGlow,
    secondary: v.muted, "secondary-foreground": v.foreground,
    muted: v.muted, accent: v.muted, "accent-foreground": v.foreground,
    border: v.border, input: v.border, ring: v.primary,
    success: v.success, warning: v.warning, destructive: v.destructive,
    sidebar: v.card, "sidebar-foreground": v.foreground, "sidebar-primary": v.primary,
    "sidebar-primary-foreground": v.primaryForeground, "sidebar-border": v.border, "sidebar-ring": v.primary,
  };
  return ":root{" + Object.entries(vars).map(([k, c]) => `--${k}:${c};`).join("") + "}";
}
