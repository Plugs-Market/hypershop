import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Eye, EyeOff, RotateCcw, Share2 } from "lucide-react";
import { getDelivery } from "@/lib/shop.functions";
import type { Delivery } from "@/lib/playlist-security";
import { Button } from "@/components/ui/button";

function PrivateField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setFailed(false); setTimeout(() => setCopied(false), 2000); }
    catch { setFailed(true); }
  }
  return <div className="min-w-0 space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="flex items-start gap-2">
      <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2 text-sm">{secret && !visible ? "••••••••••••" : value}</code>
      {secret && <Button type="button" variant="ghost" size="icon" title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>}
      <Button type="button" variant="outline" size="icon" title={`Copier ${label.toLowerCase()}`} aria-label={`Copier ${label.toLowerCase()}`} onClick={copy}><Copy className="h-4 w-4" /></Button>
    </div>
    <p role="status" className="text-xs text-muted-foreground">{copied ? "Copié" : failed ? "Copie indisponible sur ce navigateur." : ""}</p>
  </div>;
}

export function OrderDelivery({ id, authorized }: { id: string; authorized: boolean }) {
  const read = useServerFn(getDelivery);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  async function reload() {
    setBusy(true); setError(null);
    try { const result = await read({ data: { id } }); setDelivery(result.delivery); setError(result.error); }
    catch { setError("Impossible de récupérer vos accès. Réessayez."); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (authorized) void reload(); }, [id, authorized]); // eslint-disable-line react-hooks/exhaustive-deps
  async function prepare() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/public/orders/${encodeURIComponent(id)}/playlist`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) { setError(await response.text()); return; }
      setFile(new File([await response.blob()], "playlist.m3u", { type: "audio/x-mpegurl" }));
    } catch { setError("Téléchargement indisponible. Vous pouvez copier le lien M3U."); }
    finally { setBusy(false); }
  }
  function save() {
    if (!file) return;
    const url = URL.createObjectURL(file); const a = document.createElement("a");
    a.href = url; a.download = "playlist.m3u"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function share() {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Playlist M3U" }); }
      catch (e) { if ((e as DOMException).name !== "AbortError") setError("Partage indisponible. Utilisez le téléchargement."); }
    } else save();
  }
  return <section aria-labelledby="iptv-title" className="min-w-0 space-y-4 border-t border-border pt-5">
    <h2 id="iptv-title" className="text-xl font-semibold">Ma ligne IPTV</h2>
    {!authorized ? <p className="text-sm text-muted-foreground">Accès privé : ouvrez ce suivi depuis le navigateur utilisé pour votre achat. Pour une ancienne commande, contactez votre revendeur afin de récupérer vos accès de manière sécurisée.</p> : <>
      {delivery && <>
        {delivery.expiresAt && <p className="text-sm text-muted-foreground">Ligne TREX valable jusqu’au {new Date(delivery.expiresAt).toLocaleDateString("fr-FR")}</p>}
        <PrivateField label="Lien M3U" value={delivery.m3uUrl} />
        <div className="flex flex-wrap gap-2">
          {!file ? <Button variant="outline" disabled={busy} onClick={prepare}><Download className="h-4 w-4" />{busy ? "Préparation…" : "Préparer la playlist M3U"}</Button> : <>
            <Button variant="hero" onClick={save}><Download className="h-4 w-4" />Télécharger la playlist M3U</Button>
            <Button variant="outline" onClick={share}><Share2 className="h-4 w-4" />Enregistrer dans Fichiers</Button>
          </>}
        </div>
        <h3 className="text-sm font-semibold">Xtream Codes</h3>
        <PrivateField label="Serveur" value={delivery.xtream.serverUrl} />
        <PrivateField label="Identifiant" value={delivery.xtream.username} />
        <PrivateField label="Mot de passe" value={delivery.xtream.password} secret />
      </>}
      {busy && !delivery && <p className="text-sm text-muted-foreground">Récupération des accès…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {error && <Button variant="outline" disabled={busy} onClick={reload}><RotateCcw className="h-4 w-4" />Réessayer la lecture</Button>}
    </>}
  </section>;
}