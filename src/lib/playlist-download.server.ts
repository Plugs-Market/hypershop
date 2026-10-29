import { MAX_PLAYLIST_BYTES, publicAddress, supplierUrl } from "./playlist-security";

export async function fetchPlaylist(value: string): Promise<Uint8Array> {
  const signal = AbortSignal.timeout(15000);
  let url = supplierUrl(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    // Fail closed on unresolved or private addresses, including IPv6 answers.
    for (const type of ["A", "AAAA"]) {
      const dns = await fetch(`https://cloudflare-dns.com/dns-query?name=${url.hostname}&type=${type}`, { headers: { Accept: "application/dns-json" }, signal });
      if (!dns.ok) throw new Error("Téléchargement indisponible.");
      const result = await dns.json() as { Status: number; Answer?: { type: number; data: string }[] };
      if (result.Status !== 0 || result.Answer?.some(a => [1, 28].includes(a.type) && !publicAddress(a.data))) throw new Error("Destination non autorisée.");
      if (type === "A" && !result.Answer?.some(a => a.type === 1)) throw new Error("Fournisseur indisponible.");
    }
    const response = await fetch(url, { redirect: "manual", signal, headers: { Accept: "application/x-mpegURL, audio/x-mpegurl, text/plain" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === 3) throw new Error("Redirection non autorisée.");
      url = supplierUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok || !response.body) throw new Error("Le fournisseur refuse le téléchargement. Vous pouvez copier le lien M3U.");
    if (Number(response.headers.get("content-length")) > MAX_PLAYLIST_BYTES) { await response.body.cancel(); throw new Error("Playlist trop volumineuse."); }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.length;
        if (size > MAX_PLAYLIST_BYTES) throw new Error("Playlist trop volumineuse.");
        chunks.push(part.value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (!new TextDecoder().decode(bytes.slice(0, 256)).trimStart().startsWith("#EXTM3U")) throw new Error("Le fournisseur n’a pas renvoyé une playlist M3U valide. Vous pouvez copier le lien.");
    return bytes;
  }
  throw new Error("Téléchargement indisponible.");
}