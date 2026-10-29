import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { hypertv, HypertvError } from "./hypertvClient.server";
import { shopInfo } from "./shop.functions";
import { sortGuides } from "./guides";

function fail(e: unknown): never {
  console.error("guides failed", e instanceof HypertvError ? `${e.status} ${e.code}` : e);
  throw new Error("Les guides sont momentanément indisponibles. Vérifiez votre connexion et réessayez.");
}

async function loadShop() {
  const shop = await hypertv.getShopCached();
  const info = shopInfo(shop);
  if (!info.guidesEnabled) throw notFound();
  return info;
}

export const getGuidesIndex = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ category: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const shop = await loadShop();
      const [cats, list] = await Promise.all([
        hypertv.getGuideCategories(),
        hypertv.listGuides(data.category),
      ]);
      if (!cats.enabled || !list.enabled) throw notFound();
      setResponseHeader("Cache-Control", "public, max-age=300");
      return { shop, categories: cats.categories ?? [], guides: sortGuides(list.guides ?? []) };
    } catch (e) {
      if (e && typeof e === "object" && "isNotFound" in e) throw e;
      fail(e);
    }
  });

export const getGuideDetail = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const shop = await loadShop();
      const guide = await hypertv.getGuide(data.slug);
      if (!guide) throw notFound();
      setResponseHeader("Cache-Control", "public, max-age=300");
      return { shop, guide };
    } catch (e) {
      if (e && typeof e === "object" && "isNotFound" in e) throw e;
      fail(e);
    }
  });
