import type { ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";

type Shop = { name: string | null; logoUrl: string | null; slogan: string | null; guidesEnabled: boolean } | null | undefined;

export function GuidesShell({ shop, children }: { shop: Shop; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader name={shop?.name} logoUrl={shop?.logoUrl} guidesEnabled={shop?.guidesEnabled} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter name={shop?.name} slogan={shop?.slogan} />
    </div>
  );
}

export function GuidesNotFound({ label = "Guide introuvable" }: { label?: string }) {
  return (
    <GuidesShell shop={null}>
      <div className="py-16 text-center">
        <h1 className="font-display text-2xl font-bold">{label}</h1>
        <p className="mt-2 text-muted-foreground">Ce contenu n'est pas disponible.</p>
        <Link to="/" className="mt-6 inline-block text-primary hover:underline">Retour à la boutique</Link>
      </div>
    </GuidesShell>
  );
}

export function GuidesError({ error }: { error: unknown }) {
  const router = useRouter();
  return (
    <GuidesShell shop={null}>
      <div role="alert" className="py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Oups</h1>
        <p className="mt-2 text-muted-foreground">
          {error instanceof Error && error.message ? error.message : "Une erreur est survenue."}
        </p>
        <Button className="mt-6" onClick={() => router.invalidate()}>Réessayer</Button>
      </div>
    </GuidesShell>
  );
}

export function BackToGuides() {
  return (
    <Link to="/guides" search={{}} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
      <ArrowLeft className="h-4 w-4" /> Retour aux guides
    </Link>
  );
}
