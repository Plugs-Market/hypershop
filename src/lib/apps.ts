// Types et normalisation de la réponse GET /apps (partagé client/serveur).
export type ShopApp = {
  platform: string;
  label: string;
  subtitle: string | null;
  version: string | null;
  fileName: string | null;
  fileSize: number | null;
  publishedAt: string | null;
  downloadUrl: string;
};
export type AppsBlock = {
  version: string | null;
  apps: ShopApp[];
  web: { label: string; url: string } | null;
  downloader: { code: string; label: string; guideUrl: string | null } | null;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const isHttp = (u: string | null) => !!u && /^https?:\/\//i.test(u);

/** Renvoie null si le bloc est désactivé ou n'a rien à afficher. */
export function normalizeApps(raw: unknown): AppsBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r["enabled"] !== true) return null;
  const apps: ShopApp[] = (Array.isArray(r["apps"]) ? r["apps"] : []).flatMap((a): ShopApp[] => {
    if (!a || typeof a !== "object") return [];
    const o = a as Record<string, unknown>;
    const label = str(o["label"]);
    const downloadUrl = str(o["downloadUrl"]);
    if (!label || !isHttp(downloadUrl)) return [];
    return [{
      platform: (str(o["platform"]) ?? "").toLowerCase(),
      label,
      subtitle: str(o["subtitle"]),
      version: str(o["version"]),
      fileName: str(o["fileName"]),
      fileSize: typeof o["fileSize"] === "number" && o["fileSize"] > 0 ? o["fileSize"] : null,
      publishedAt: str(o["publishedAt"]),
      downloadUrl: downloadUrl!,
    }];
  });
  const w = r["web"] as Record<string, unknown> | null | undefined;
  const webUrl = str(w?.["url"]);
  const web = w && isHttp(webUrl) ? { label: str(w["label"]) ?? "Version web", url: webUrl! } : null;
  const d = r["downloader"] as Record<string, unknown> | null | undefined;
  const code = d ? str(d["code"]) ?? (typeof d["code"] === "number" ? String(d["code"]) : null) : null;
  const guide = str(d?.["guideUrl"]);
  const downloader = d && code ? { code, label: str(d["label"]) ?? "Downloader", guideUrl: isHttp(guide) ? guide : null } : null;
  if (!apps.length && !web && !downloader) return null;
  return { version: str(r["version"]), apps, web, downloader };
}

export function formatFileSize(bytes: number | null): string | null {
  if (!bytes) return null;
  const mo = bytes / (1024 * 1024);
  if (mo < 0.1) return null;
  return `${mo.toLocaleString("fr-FR", { maximumFractionDigits: mo < 10 ? 1 : 0 })} Mo`;
}
