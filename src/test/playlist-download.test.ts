import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPlaylist } from "@/lib/playlist-download.server";
import { MAX_PLAYLIST_BYTES } from "@/lib/playlist-security";

const dns = (type: number, data: string) => Response.json({ Status: 0, Answer: [{ type, data }] });
afterEach(() => vi.unstubAllGlobals());
describe("téléchargement réel du contenu fournisseur", () => {
  it("renvoie les octets M3U et non un fichier contenant son URL", async () => {
    const content = '#EXTM3U\n#EXTINF:-1,Chaîne test\nhttps://line.hypertv.info/test.ts\n';
    const fetch = vi.fn().mockResolvedValueOnce(dns(1, "1.1.1.1")).mockResolvedValueOnce(dns(28, "2606:4700::1111")).mockResolvedValueOnce(new Response(content));
    vi.stubGlobal("fetch", fetch);
    expect(new TextDecoder().decode(await fetchPlaylist("https://line.hypertv.info/get.php"))).toBe(content);
    expect(fetch.mock.calls[2]?.[1].redirect).toBe("manual");
  });
  it("bloque une destination DNS locale avant téléchargement", async () => {
    const fetch = vi.fn().mockResolvedValue(dns(1, "127.0.0.1")); vi.stubGlobal("fetch", fetch);
    await expect(fetchPlaylist("https://line.hypertv.info/get.php")).rejects.toThrow("Destination non autorisée");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("bloque une redirection hors du fournisseur autorisé", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(dns(1, "1.1.1.1")).mockResolvedValueOnce(dns(28, "2606:4700::1111")).mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "http://169.254.169.254/" } })));
    await expect(fetchPlaylist("https://line.hypertv.info/get.php")).rejects.toThrow("Fournisseur non autorisé");
  });
  it("refuse un faux fichier M3U ou une réponse vide", async () => {
    for (const content of ["", "<html>Access denied</html>"]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(dns(1, "1.1.1.1")).mockResolvedValueOnce(dns(28, "2606:4700::1111")).mockResolvedValueOnce(new Response(content)));
      await expect(fetchPlaylist("https://line.hypertv.info/get.php")).rejects.toThrow("playlist M3U valide");
    }
  });
  it("refuse les fichiers dépassant la taille maximale", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(dns(1, "1.1.1.1")).mockResolvedValueOnce(dns(28, "2606:4700::1111")).mockResolvedValueOnce(new Response("#EXTM3U", { headers: { "Content-Length": String(MAX_PLAYLIST_BYTES + 1) } })));
    await expect(fetchPlaylist("https://line.hypertv.info/get.php")).rejects.toThrow("trop volumineuse");
  });
});