import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion admin — HyperTV" },
      { name: "description", content: "Espace administrateur de la boutique HyperTV." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Connexion admin — HyperTV" },
      { property: "og:description", content: "Espace administrateur de la boutique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setMsg("Identifiants incorrects ou email non confirmé.");
      navigate({ to: "/test-api" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth" } });
      setLoading(false);
      setMsg(error ? error.message : "Compte créé. Confirmez votre email puis connectez-vous.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <SiteHeader />
      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-2xl font-bold">{mode === "in" ? "Connexion admin" : "Créer le compte admin"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="space-y-2"><Label htmlFor="e">Email</Label><Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="p">Mot de passe</Label><Input id="p" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          <Button type="submit" variant="hero" className="w-full" disabled={loading}>{mode === "in" ? "Se connecter" : "Créer le compte"}</Button>
          <button type="button" className="w-full text-xs text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Première fois ? Créer le compte" : "Déjà un compte ? Se connecter"}
          </button>
        </form>
      </main>
    </div>
  );
}
