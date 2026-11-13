import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ offers: vi.fn(), shop: vi.fn(), header: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ handler: (f: unknown) => f, inputValidator: () => ({ handler: (f: unknown) => f }) }), createServerOnlyFn: (f: unknown) => f }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: mocks.header, getRequestHeader: vi.fn() }));
vi.mock("@/lib/order-access.server", () => ({ ownerHash: vi.fn(), ownsOrder: vi.fn(), hashValue: vi.fn() }));
vi.mock("@/lib/hypertvClient.server", () => ({ HypertvError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }, hypertv: { getOffersWithStatus: mocks.offers, getShop: mocks.shop } }));
import { getCatalog } from "@/lib/shop.functions";
import { HypertvError } from "@/lib/hypertvClient.server";
const read = getCatalog as unknown as () => Promise<{ error: string | null; diagnostics: { httpStatus: number | null; counts: unknown } }>;
beforeEach(() => { vi.clearAllMocks(); mocks.shop.mockResolvedValue(null); });
describe("catalogue : erreurs et diagnostic public sans données privées", () => {
  it.each([401, 403, 503])("ne transforme pas HTTP %s en catalogue vide réussi", async status => {
    mocks.offers.mockRejectedValue(new HypertvError(status, "unauthorized", "private-provider-message"));
    const result = await read();
    expect(result.error).not.toBeNull();
    expect(result.diagnostics.httpStatus).toBe(status);
    expect(JSON.stringify(result)).not.toContain("private-provider-message");
    expect(mocks.header).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("rapporte les comptes bruts et le statut HTTP même si trexPlans est vide", async () => {
    mocks.offers.mockResolvedValue({ status: 200, data: { resellerOffers: [{ id: "pack" }], subscriptionPlans: [], lionPlans: [], trexPlans: [] } });
    const result = await read();
    expect(result.error).toBeNull();
    expect(result.diagnostics).toEqual({ httpStatus: 200, counts: { resellerOffers: 1, subscriptionPlans: 0, lionPlans: 0, trexPlans: 0, hypervodPlans: 0 } });
  });
});