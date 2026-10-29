import { Link } from "@tanstack/react-router";
import { Tv } from "lucide-react";

export function SiteHeader({ name, logoUrl }: { name?: string | null; logoUrl?: string | null }) {
  const brand = (name ?? "").trim() || "Boutique";
  const parts = brand.split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : null;
  return (
    <header className="border-b border-border/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          {logoUrl ? (
            <img src={logoUrl} alt={brand} className="h-8 w-8 rounded-lg object-cover shadow-glow" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Tv className="h-4 w-4 text-primary-foreground" />
            </span>
          )}
          {parts.join(" ")}
          {last && <> <span className="text-primary">{last}</span></>}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Formules</Link>
        </nav>
      </div>
    </header>
  );
}
