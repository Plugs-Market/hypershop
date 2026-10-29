import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeById } from "@/lib/support";

describe("synchronisation du support", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("ajoute les nouveaux messages sans doublon par id", () => {
    const old = [{ id: "a", createdAt: "2026-01-01T00:00:00Z" }, { id: "b", createdAt: "2026-01-02T00:00:00Z" }];
    const merged = mergeById(old, [{ id: "b", createdAt: "2026-01-02T00:00:00Z" }, { id: "c", createdAt: "2026-01-03T00:00:00Z" }]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("transmet after, include=devices et If-None-Match, et signale un 304", async () => {
    vi.stubEnv("HYPERTV_SHOP_KEY", "k");
    const fetchMock = vi.fn(async () => new Response(null, { status: 304, headers: { ETag: '"v2"' } }));
    vi.stubGlobal("fetch", fetchMock);
    const { hypertv } = await import("@/lib/hypertvClient.server");
    const r = await hypertv.supportTicket("sess", "t1", "d1", { after: "2026-01-03T00:00:00Z", etag: '"v1"' });
    expect(r.status).toBe(304);
    expect(r.data).toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("after=2026-01-03T00%3A00%3A00Z");
    expect(url).not.toContain("include=devices");
    expect((init.headers as Record<string, string>)["If-None-Match"]).toBe('"v1"');
    await hypertv.supportTicket("sess", "t1", "d1", { includeDevices: true });
    expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toContain("include=devices");
  });

  it("renvoie l'ETag reçu avec les données", async () => {
    vi.stubEnv("HYPERTV_SHOP_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ticket: { id: "t1" }, messages: [] }), { status: 200, headers: { ETag: '"v3"' } })));
    const { hypertv } = await import("@/lib/hypertvClient.server");
    const r = await hypertv.supportTicket("sess", "t1", "d1");
    expect(r.etag).toBe('"v3"');
  });
});
