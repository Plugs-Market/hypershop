// Types et règles partagées des guides (sans accès réseau).
export type GuideCategory = { id: string; name: string; slug: string };
export type GuideCategoryRef = { id?: string; name: string; slug: string } | null;
export type GuideSummary = {
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  featured: boolean;
  publishedAt: string | null;
  category: GuideCategoryRef;
};
export type GuideDetail = {
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  contentMd: string;
  publishedAt: string | null;
  updatedAt: string | null;
  category: GuideCategoryRef;
};
export type GuideCategoriesResponse = { enabled: boolean; categories: GuideCategory[] };
export type GuidesListResponse = { enabled: boolean; guides: GuideSummary[] };

/** Guides mis en avant d'abord, puis du plus récent au plus ancien. */
export function sortGuides(guides: GuideSummary[]): GuideSummary[] {
  const t = (d: string | null) => (d ? Date.parse(d) || 0 : 0);
  return [...guides].sort((a, b) => {
    if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
    return t(b.publishedAt) - t(a.publishedAt);
  });
}

export function formatGuideDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
