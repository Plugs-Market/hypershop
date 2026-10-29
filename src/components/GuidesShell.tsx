import type { ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";

type Shop = { name: string | null; logoUrl: string | null; slogan: string | null; guidesEnabled: boolean } | null | undefined;

export function GuidesShell({ shop, children, conversation = false }: { shop: Shop; children: ReactNode; conversation?: boolean }) {
  return (
    <div className={conversation ? "fixed inset-x-0 top-[env(safe-area-inset-top)] flex h-[calc(100dvh-env(safe-area-inset-top))] min-h-0 flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]" : "flex min-h-screen flex-col"}>
      <SiteHeader name={shop?.name ?? null} logoUrl={shop?.logoUrl ?? null} guidesEnabled={shop?.guidesEnabled ?? false} />
      <main className={conversation ? "mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden" : "mx-auto w-full max-w-6xl flex-1 px-4 py-8"}>{children}</main>
      {!conversation && <SiteFooter name={shop?.name ?? null} slogan={shop?.slogan ?? null} />}
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
