import { describe, expect, it } from "vitest";
import { sortGuides, type GuideSummary } from "@/lib/guides";

const g = (slug: string, featured: boolean, publishedAt: string | null): GuideSummary => ({
  slug, title: slug, featured, publishedAt, excerpt: null, coverUrl: null, category: null,
});

describe("sortGuides", () => {
  it("met les guides featured en premier puis les plus récents", () => {
    const out = sortGuides([g("old", false, "2026-01-01"), g("feat", true, "2025-01-01"), g("new", false, "2026-06-01")]);
    expect(out.map((x) => x.slug)).toEqual(["feat", "new", "old"]);
  });
});
