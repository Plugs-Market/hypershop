import { describe, expect, it } from "vitest";
import { formatFileSize, normalizeApps } from "@/lib/apps";

describe("normalizeApps", () => {
  it("masque le bloc si enabled est false", () => {
    expect(normalizeApps({ enabled: false, apps: [{ label: "A", downloadUrl: "https://x/a.apk" }] })).toBeNull();
  });
  it("masque le bloc si rien n'est à afficher", () => {
    expect(normalizeApps({ enabled: true, apps: [], web: null, downloader: null })).toBeNull();
  });
  it("garde l'URL de téléchargement telle quelle", () => {
    const r = normalizeApps({ enabled: true, version: "2.1", apps: [{ platform: "android", label: "Android", downloadUrl: "https://cdn.x/a.apk?sig=1" }] });
    expect(r?.apps[0]?.downloadUrl).toBe("https://cdn.x/a.apk?sig=1");
  });
});
it("affiche la taille en Mo", () => {
  expect(formatFileSize(52428800)).toBe("50 Mo");
});
