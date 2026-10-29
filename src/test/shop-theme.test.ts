import { describe, it, expect } from "vitest";
import { buildThemeCss } from "@/lib/shop-theme";

const ok = { background: "#101010", foreground: "#ffffff", card: "#202020", primary: "#ff0000", primaryForeground: "#ffffff", primaryGlow: "#ff5500", muted: "#303030", border: "#404040", success: "#00ff00", warning: "#ffaa00", destructive: "#ee0000" };

describe("buildThemeCss", () => {
  it("valid palette produces css", () => {
    const css = buildThemeCss(ok)!;
    expect(css).toContain("--primary:#ff0000;");
    expect(css).toContain("--background:#101010;");
  });
  it.each(["red", "#fff", "#12345g", "#101010;}body{x"])("rejects %s", (bad) => {
    expect(buildThemeCss({ ...ok, primary: bad })).toBeNull();
  });
  it("rejects missing key", () => {
    const { warning: _w, ...rest } = ok;
    expect(buildThemeCss(rest)).toBeNull();
    expect(buildThemeCss(null)).toBeNull();
  });
});
