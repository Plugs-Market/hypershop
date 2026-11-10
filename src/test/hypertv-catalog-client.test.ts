import { afterEach, describe, expect, it, vi } from "vitest";
import { hypertv, HypertvError } from "@/lib/hypertvClient.server";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("API catalogue et commande partagée", () => {
  it("recharge les offres sans cache serveur", async () => {
    vi.stubEnv("HYPERTV_SHOP_KEY", "test-only-credential");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ resellerOffers: [], subscriptionPlans: [], trexPlans: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    expect((await hypertv.getOffersWithStatus()).status).toBe(200);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://hypertv.win/api/public/shop/v1/offers");
    expect(fetcher.mock.calls[0]?.[1].cache).toBe("no-store");
  });
  it.each([401, 403, 503])("propage le statut HTTP %s", async status => {
    vi.stubEnv("HYPERTV_SHOP_KEY", "test-only-credential");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "unavailable" }), { status })));
    await expect(hypertv.getOffersWithStatus()).rejects.toMatchObject({ status });
    await expect(hypertv.getOffers()).rejects.toBeInstanceOf(HypertvError);
  });
  it("conserve trexPlanId et la commande gratuite renvoyée sans paiement ou activation supplémentaire", async () => {
    vi.stubEnv("HYPERTV_SHOP_KEY", "test-only-credential");
    const order = { id: "free-order", type: "trex", provider: "8kpro", state: "activated", priceEur: 0 };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ order }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const input = { trexPlanId: "supplier-offer-id", mac: "00:1A:79:AB:CD:EF", method: "free", idempotencyKey: "12345678-1234-4123-8123-123456789abc" };
    expect(await hypertv.createOrder(input)).toEqual(order);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://hypertv.win/api/public/shop/v1/orders");
    expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual(input);
  });
});