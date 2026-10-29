import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cookie: vi.fn(), setCookie: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerOnlyFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-start/server", () => ({ getCookie: mocks.cookie, setCookie: mocks.setCookie, getRequestUrl: () => "https://shop.hypertv.win" }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ select: mocks.select }) } }));
import { ownerHash, ownsOrder, hashValue } from "@/lib/order-access.server";
import { webcrypto } from "node:crypto";
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); vi.clearAllMocks(); mocks.cookie.mockReturnValue(undefined); mocks.select.mockReturnValue({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }); });
describe("preuve propriétaire côté serveur", () => {
  it("un UUID seul ne donne aucun accès", async () => {
    expect(await ownsOrder("12345678-1234-4123-8123-123456789abc")).toBe(false);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("refuse le cookie d’un autre acheteur", async () => {
    mocks.cookie.mockReturnValue("a".repeat(64)); mocks.maybeSingle.mockResolvedValue({ data: { owner_hash: await hashValue("b".repeat(64)) }, error: null });
    expect(await ownsOrder("12345678-1234-4123-8123-123456789abc")).toBe(false);
  });
  it("autorise seulement le cookie correspondant à la commande", async () => {
    mocks.cookie.mockReturnValue("a".repeat(64)); mocks.maybeSingle.mockResolvedValue({ data: { owner_hash: await hashValue("a".repeat(64)) }, error: null });
    expect(await ownsOrder("12345678-1234-4123-8123-123456789abc")).toBe(true);
  });
  it("crée une preuve aléatoire de 256 bits HttpOnly et Secure", async () => {
    expect(await ownerHash(true)).toMatch(/^[a-f0-9]{64}$/);
    const call = mocks.setCookie.mock.calls[0];
    expect(call?.[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(call?.[2]).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
  });
});