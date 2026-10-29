import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, ShoppingBag, Tv, UserRound } from "lucide-react";
import { accountStatusQuery } from "@/lib/account.functions";
import { appsQuery } from "@/lib/apps.functions";

export function SiteHeader({ name, logoUrl, guidesEnabled }: { name?: string | null; logoUrl?: string | null; guidesEnabled?: boolean }) {
  const { data: apps } = useQuery(appsQuery);
  const { data: status } = useQuery(accountStatusQuery);
  const brand = (name ?? "").trim() || "Boutique";
  const parts = brand.split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : null;
  return (
    <>
    <header className="fixed inset-x-0 top-0 z-50 px-2 pt-[calc(var(--safe-top)+0.5rem)] sm:px-4">
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 shadow-lg backdrop-blur-md sm:flex sm:justify-between sm:px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2 font-display text-base font-bold sm:text-lg">
          {logoUrl ? (
            // Les URL signées de l'API tournent entre le rendu serveur et le client.
            <img src={logoUrl} alt={brand} suppressHydrationWarning className="h-8 w-8 shrink-0 rounded-lg object-cover shadow-glow" />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Tv className="h-4 w-4 text-primary-foreground" />
            </span>
          )}
          <span className="truncate">{parts.join(" ")}{last && <> <span className="text-primary">{last}</span></>}</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {guidesEnabled && (
            <Link aria-label="Guides"
              to="/guides"
              className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-border bg-card/60 sm:h-auto sm:w-auto sm:px-4 sm:py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-accent"
            >
              <BookOpen className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Guides</span>
            </Link>
          )}
          {apps && (
            <Link aria-label="Télécharger"
              to="/telecharger"
              className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-border bg-card/60 sm:h-auto sm:w-auto sm:px-4 sm:py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-accent"
            >
              <Download className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Télécharger</span>
            </Link>
          )}
          <Link aria-label="Boutique"
            to="/"
            // Ramène aussi au choix des catégories quand on est déjà sur l'accueil.
            onClick={() => window.dispatchEvent(new Event("shop:home"))}
            className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-border bg-card/60 sm:h-auto sm:w-auto sm:px-4 sm:py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-accent"
          >
            <ShoppingBag className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Boutique</span>
          </Link>
          <Link aria-label={status?.loggedIn ? "Mon compte" : "Connexion"}
            to={status?.loggedIn ? "/mon-compte" : "/connexion"}
            className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-border bg-card/60 sm:h-auto sm:w-auto sm:px-4 sm:py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-accent"
          >
            <UserRound className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">{status?.loggedIn ? "Mon compte" : "Connexion"}</span>
          </Link>
        </nav>
      </div>
    </header>
    <div aria-hidden className="h-[calc(var(--safe-top)+4.5rem)] shrink-0" />
    </>
  );
}
