import { Apple, Download, Globe, Monitor, Smartphone, Tv } from "lucide-react";
import { formatFileSize, type AppsBlock } from "@/lib/apps";

function PlatformIcon({ platform }: { platform: string }) {
  const cls = "h-6 w-6 text-primary";
  if (platform === "android") return <Smartphone className={cls} />;
  if (platform === "windows") return <Monitor className={cls} />;
  if (platform === "macos" || platform === "mac" || platform === "ios") return <Apple className={cls} />;
  if (platform === "samsung" || platform === "lg") return <Tv className={cls} />;
  return <Download className={cls} />;
}

export function DownloadApps({ data }: { data: AppsBlock }) {
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-border bg-card/60 p-5 shadow-card md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold md:text-2xl">Télécharger HyperTV</h2>
          <p className="text-sm text-muted-foreground">Dernière version publiée</p>
        </div>
        {data.version && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
            VERSION {data.version}
          </span>
        )}
      </div>

      {data.apps.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {data.apps.map((a) => {
            const size = formatFileSize(a.fileSize);
            return (
              <a
                key={a.platform + a.downloadUrl}
                href={a.downloadUrl}
                className="flex items-center gap-4 rounded-xl border border-border bg-background/60 p-4 transition-colors hover:border-primary/60 hover:bg-accent"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10">
                  <PlatformIcon platform={a.platform} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{a.label}</span>
                  {(a.subtitle || size) && (
                    <span className="block text-sm text-muted-foreground">
                      {[a.subtitle, size].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <Download className="h-5 w-5 shrink-0 text-muted-foreground" />
              </a>
            );
          })}
        </div>
      )}

      {data.web && (
        <a
          href={data.web.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/60 px-4 py-3 font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <Globe className="h-5 w-5" /> {data.web.label}
        </a>
      )}

      {data.downloader && (
        <div className="mt-5 rounded-xl border border-border bg-background/60 p-4 text-center">
          <p className="font-bold">{data.downloader.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">Ouvrez l'app Downloader et tapez le code :</p>
          <p className="mt-2 font-mono text-4xl font-bold tracking-widest text-primary">{data.downloader.code}</p>
        </div>
      )}
    </section>
  );
}
