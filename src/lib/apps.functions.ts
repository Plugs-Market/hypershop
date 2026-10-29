import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { hypertv, HypertvError } from "./hypertvClient.server";
import { normalizeApps } from "./apps";

// Ne lève jamais : en cas d'erreur, le bloc est simplement masqué.
export const getApps = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return normalizeApps(await hypertv.getApps());
  } catch (e) {
    console.error("apps failed", e instanceof HypertvError ? `${e.status} ${e.code}` : e);
    return null;
  }
});

export const appsQuery = queryOptions({
  queryKey: ["apps"],
  queryFn: () => getApps(),
  staleTime: 300_000,
});
