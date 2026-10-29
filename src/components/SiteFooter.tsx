import { Link } from "@tanstack/react-router";
import { Tv, Zap } from "lucide-react";

export function SiteFooter({ name, slogan }: { name?: string | null; slogan?: string | null }) {
  const brand = (name ?? "").trim() || "Boutique";
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link to="/" className="flex items-center gap-2 font-display text-base font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Tv className="h-4 w-4 text-primary-foreground" />
            </span>
            {brand}
          </Link>
          <p className="max-w-md text-sm text-muted-foreground">
            {slogan?.trim() || "Choisissez une formule, saisissez l'adresse MAC de votre appareil, c'est tout."}
          </p>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" /> Activation automatique après paiement
          </p>
        </div>
        <div className="mt-8 border-t border-border/60 pt-5 text-center text-xs text-muted-foreground">
          © {year} {brand}. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
