import { describe, expect, it } from "vitest";
import { isValidMac, normalizeMac, translateHypertvError } from "@/lib/hypertv-shared";

describe("MAC", () => {
  it("accepte XX:XX:XX:XX:XX:XX", () => expect(isValidMac("00:1A:79:AB:CD:EF")).toBe(true));
  it("normalise minuscules et tirets", () => expect(normalizeMac("00-1a-79-ab-cd-ef")).toBe("00:1A:79:AB:CD:EF"));
  it("refuse un format incomplet", () => expect(isValidMac("00:1A:79:AB:CD")).toBe(false));
  it("refuse des caractères non hexadécimaux", () => expect(isValidMac("00:1A:79:AB:CD:EG")).toBe(false));
});

describe("erreurs HyperTV", () => {
  it("customer_not_found", () =>
    expect(translateHypertvError(404, "customer_not_found")).toBe(
      "Aucun compte HyperTV avec cette adresse MAC",
    ));
  it("customer_locked_to_other_reseller", () =>
    expect(translateHypertvError(409, "customer_locked_to_other_reseller")).toBe(
      "Ce compte est géré par un autre revendeur",
    ));
  it("plan_not_for_sale", () =>
    expect(translateHypertvError(422, "plan_not_for_sale")).toBe("Cette formule n'est plus disponible"));
  it("payment_method_unavailable", () =>
    expect(translateHypertvError(422, "payment_method_unavailable")).toBe("Mode de paiement indisponible."));
  it("invalid_request demande de vérifier MAC et email", () =>
    expect(translateHypertvError(400, "invalid_request")).toBe("Vérifiez la MAC et l'email."));
  it("txid_already_used", () =>
    expect(translateHypertvError(409, "txid_already_used")).toBe("Cet ID de transaction a déjà été utilisé."));
  it("invalid_txid", () =>
    expect(translateHypertvError(422, "invalid_txid")).toBe("ID de transaction invalide."));
  it("401 et 403 restent génériques, sans détail", () => {
    expect(translateHypertvError(401, "unauthorized", "bad key")).toBe("Boutique temporairement indisponible.");
    expect(translateHypertvError(403, "origin_not_allowed", "origin")).toBe("Boutique temporairement indisponible.");
  });
  it("erreur réseau invite à réessayer", () =>
    expect(translateHypertvError(0, "network_error")).toContain("Nouvel essai"));
});
