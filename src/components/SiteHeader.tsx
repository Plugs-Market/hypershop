import { useLayoutEffect, useRef } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, ShoppingBag, Tv, UserRound } from "lucide-react";
import { accountStatusQuery } from "@/lib/account.functions";
import { appsQuery } from "@/lib/apps.functions";

const navLinkClass =
  "inline-flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-border bg-card/60 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-accent sm:h-auto sm:w-auto sm:px-4 sm:py-2";
// Style du bouton de la section en cours de visite.
const navLinkActiveClass = "border-primary/70 bg-primary/15 text-primary shadow-glow";

export function SiteHeader({ name, logoUrl, guidesEnabled }: { name?: string | null; logoUrl?: string | null; guidesEnabled?: boolean }) {
  const { data: apps } = useQuery(appsQuery);
  const { data: status } = useQuery(accountStatusQuery);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Le bloc de téléchargement vit sur l'accueil : on y revient puis on défile jusqu'à lui.
  const goDownload = () => {
    if (pathname !== "/") {
      void navigate({ to: "/" });
      setTimeout(() => window.dispatchEvent(new Event("shop:download")), 350);
    } else {
      window.dispatchEvent(new Event("shop:download"));
    }
  };
  const brand = (name ?? "").trim() || "Boutique";
  const parts = brand.split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : null;
  const headerRef = useRef<HTMLElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  // Le contenu commence exactement sous la barre flottante, quel que soit le
  // décalage appliqué par l'appareil (app iOS installée, navigateur…).
  useLayoutEffect(() => {
    const header = headerRef.current;
    const spacer = spacerRef.current;
    if (!header || !spacer) return;
    const fit = () => {
      const top = spacer.getBoundingClientRect().top + window.scrollY;
      const bottom = header.getBoundingClientRect().bottom;
      spacer.style.height = `${Math.max(0, Math.round(bottom - top))}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(header);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, []);
  return (
    <>
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-50 px-2 pt-[calc(var(--safe-top)+0.5rem)] sm:px-4">
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
          <Link aria-label="Boutique"
            to="/"
            activeOptions={{ exact: true }}
            // Ramène aussi au choix des catégories quand on est déjà sur l'accueil.
            onClick={() => window.dispatchEvent(new Event("shop:home"))}
            className={navLinkClass}
            activeProps={{ className: navLinkActiveClass }}
          >
            <ShoppingBag className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Boutique</span>
          </Link>
          {apps && (
            <button type="button" aria-label="Télécharger"
              onClick={goDownload}
              className={navLinkClass}
            >
              <Download className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Télécharger</span>
            </button>
          )}
          {guidesEnabled && (
            <Link aria-label="Guides"
              to="/guides"
              className={navLinkClass}
              activeProps={{ className: navLinkActiveClass }}
            >
              <BookOpen className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Guides</span>
            </Link>
          )}
          <Link aria-label={status?.loggedIn ? "Mon compte" : "Connexion"}
            to={status?.loggedIn ? "/mon-compte" : "/connexion"}
            className={navLinkClass}
            activeProps={{ className: navLinkActiveClass }}
          >
            <UserRound className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">{status?.loggedIn ? "Mon compte" : "Connexion"}</span>
          </Link>
        </nav>
      </div>
    </header>
    <div ref={spacerRef} aria-hidden className="h-[calc(var(--safe-top)+4rem)] shrink-0" />
    </>
  );
}
