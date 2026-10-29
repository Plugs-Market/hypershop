import { useEffect, useRef, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";

type Shop = { name: string | null; logoUrl: string | null; slogan: string | null; guidesEnabled: boolean } | null | undefined;

/**
 * Pins the conversation layout to the real visible screen.
 * iOS home-screen apps (black-translucent status bar) report a viewport shorter
 * than the screen, which left an empty band under the composer. In standalone
 * mode we size the shell from the physical screen height; when the keyboard is
 * open we follow the visual viewport so the composer stays above it.
 */
function useConversationViewport(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const vv = window.visualViewport;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const update = () => {
      const portrait = window.innerHeight >= window.innerWidth;
      const screenH = portrait
        ? Math.max(window.screen.width, window.screen.height)
        : Math.min(window.screen.width, window.screen.height);
      const vh = vv?.height ?? window.innerHeight;
      const keyboard = vh < window.innerHeight * 0.8;
      let height: number;
      if (keyboard) height = vh;
      else if (standalone) height = Math.max(screenH, window.innerHeight);
      else height = window.innerHeight;
      el.style.height = `${Math.round(height)}px`;
      el.style.transform = keyboard && vv ? `translateY(${Math.round(vv.offsetTop)}px)` : "";
      el.dataset["keyboard"] = keyboard ? "true" : "false";
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [enabled]);
  return ref;
}

export function GuidesShell({ shop, children, conversation = false }: { shop: Shop; children: ReactNode; conversation?: boolean }) {
  const ref = useConversationViewport(conversation);
  return (
    <div
      ref={ref}
      className={
        conversation
          ? "fixed inset-x-0 top-0 flex h-dvh min-h-0 flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] pb-[max(0px,calc(env(safe-area-inset-bottom)-1.25rem))] data-[keyboard=true]:pb-0"
          : "flex min-h-screen flex-col"
      }
    >
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
