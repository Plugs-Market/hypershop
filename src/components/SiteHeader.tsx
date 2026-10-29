import { Link } from "@tanstack/react-router";
import { BookOpen, ShoppingBag, Tv } from "lucide-react";

export function SiteHeader({ name, logoUrl, guidesEnabled }: { name?: string | null; logoUrl?: string | null; guidesEnabled?: boolean }) {
  const brand = (name ?? "").trim() || "Boutique";
  const parts = brand.split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : null;
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          {logoUrl ? (
            // Les URL signées de l'API tournent entre le rendu serveur et le client.
            <img src={logoUrl} alt={brand} suppressHydrationWarning className="h-8 w-8 rounded-lg object-cover shadow-glow" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Tv className="h-4 w-4 text-primary-foreground" />
            </span>
          )}
          {parts.join(" ")}
          {last && <> <span className="text-primary">{last}</span></>}
        </Link>
        <nav className="flex items-center gap-2">
          {guidesEnabled && (
            <Link aria-label="Guides"
              to="/guides"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-2 sm:px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-accent"
            >
              <BookOpen className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Guides</span>
            </Link>
          )}
          <Link aria-label="Boutique"
            to="/"
            // Ramène aussi au choix des catégories quand on est déjà sur l'accueil.
            onClick={() => window.dispatchEvent(new Event("shop:home"))}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-2 sm:px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-accent"
          >
            <ShoppingBag className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Boutique</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
