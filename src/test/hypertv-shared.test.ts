import { describe, expect, it } from "vitest";
import { isValidMac, normalizeMac, translateHypertvError, isRetryableCode } from "@/lib/hypertv-shared";

describe("MAC", () => {
  it("accepte XX:XX:XX:XX:XX:XX", () => expect(isValidMac("00:1A:79:AB:CD:EF")).toBe(true));
  it("normalise minuscules et tirets", () => expect(normalizeMac("00-1a-79-ab-cd-ef")).toBe("00:1A:79:AB:CD:EF"));
  it("refuse un format incomplet", () => expect(isValidMac("00:1A:79:AB:CD")).toBe(false));
  it("refuse des caractères non hexadécimaux", () => expect(isValidMac("00:1A:79:AB:CD:EG")).toBe(false));
});

describe("erreurs HyperTV", () => {
  it("409 in_progress est réessayable", () => expect(isRetryableCode("in_progress")).toBe(true));
  it("erreur réseau est réessayable", () => expect(isRetryableCode("network_error")).toBe(true));
  it("appareil verrouillé n'est pas réessayable", () => expect(isRetryableCode("customer_locked_to_other_reseller")).toBe(false));
  it("crédits insuffisants -> message dédié", () =>
    expect(translateHypertvError(422, "message", "Crédits insuffisants")).toContain("stock revendeur insuffisant"));
});
