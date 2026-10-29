import { describe, it, expect } from "vitest";
import { normalizeAccessKey, usernameSchema, translateAccountError } from "@/lib/account";
describe("account", () => {
  it("normalise la clé en majuscules groupées par 5", () => {
    expect(normalizeAccessKey("abcde12345fghij")).toBe("ABCDE-12345-FGHIJ");
  });
  it("valide le pseudo 2-30 caractères autorisés", () => {
    expect(usernameSchema.safeParse("a").success).toBe(false);
    expect(usernameSchema.safeParse("Jean_D.-1 x").success).toBe(true);
    expect(usernameSchema.safeParse("bad@name").success).toBe(false);
    expect(usernameSchema.safeParse("x".repeat(31)).success).toBe(false);
  });
  it("traduit les erreurs", () => {
    expect(translateAccountError("invalid_key")).toBe("Clé inconnue");
    expect(translateAccountError("invalid_code")).toBe("Code incorrect");
    expect(translateAccountError("mfa_token_invalid")).toBe("Délai dépassé, recommencez");
    expect(translateAccountError("too_many_attempts")).toBe("Trop de tentatives, réessayez plus tard");
  });
});
