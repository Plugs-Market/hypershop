import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { getAccountStatus, loginWithKey, loginWithMfa } from "@/lib/account.functions";
import { ACCESS_KEY_REGEX, normalizeAccessKey } from "@/lib/account";
import { GuidesShell } from "@/components/GuidesShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shopQuery } from "@/routes/mon-compte";

export const Route = createFileRoute("/connexion")({
  beforeLoad: async () => {
    const s = await getAccountStatus();
    if (s.loggedIn) throw redirect({ to: "/mon-compte" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(shopQuery),
  head: ({ loaderData }) => {
    const title = `Connexion — ${loaderData?.name ?? "Boutique"}`;
    const description = "Connectez-vous à votre espace client HyperTV avec votre clé d'accès.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const { data: shop } = useSuspenseQuery(shopQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const login = useServerFn(loginWithKey);
  const mfa = useServerFn(loginWithMfa);
  const [key, setKey] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"key" | "mfa">("key");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function done() {
    await qc.invalidateQueries({ queryKey: ["account-status"] });
    await navigate({ to: "/mon-compte", replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (step === "key" && !ACCESS_KEY_REGEX.test(key)) return setError("Format attendu : XXXXX-XXXXX-XXXXX");
    if (step === "mfa" && !/^\d{6}$/.test(code)) return setError("Saisissez les 6 chiffres.");
    setLoading(true);
    try {
      if (step === "key") {
        const r = await login({ data: { accessKey: key } });
        setKey("");
        if (r.mfaRequired) { setStep("mfa"); setLoading(false); return; }
      } else {
        await mfa({ data: { code } });
      }
      await done();
    } catch (err) {
      const msg = (err as Error).message || "Erreur de connexion.";
      setError(msg);
      if (msg.startsWith("Délai dépassé")) { setStep("key"); setCode(""); }
      setLoading(false);
    }
  }

  return (
    <GuidesShell shop={shop}>
      <div className="mx-auto w-full max-w-md py-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <KeyRound className="h-5 w-5 text-primary-foreground" />
          </span>
          <h1 className="text-2xl font-bold">Espace client</h1>
        </div>
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-6">
          {step === "key" ? (
            <div className="space-y-2">
              <Label htmlFor="key">Clé d'accès HyperTV</Label>
              <Input id="key" autoComplete="off" spellCheck={false} value={key}
                onChange={(e) => setKey(normalizeAccessKey(e.target.value))}
                placeholder="XXXXX-XXXXX-XXXXX" maxLength={17} className="font-mono uppercase" />
              <p className="text-xs text-muted-foreground">Visible dans l'application HyperTV › Profil.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="code">Code à 6 chiffres (Google Authenticator)</Label>
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456" className="font-mono tracking-widest" />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Connexion…" : step === "key" ? "Se connecter" : "Valider le code"}
          </Button>
        </form>
      </div>
    </GuidesShell>
  );
}
