# Section « Guides »

## Ce que verront vos clients
- Un lien « Guides » dans l'en-tête, à côté de « Boutique », visible seulement si les guides sont activés dans votre panel revendeur.
- Page **/guides** : puces de catégories (« Tous » + catégories de l'API), grille de cartes (image, titre, résumé, date, badge catégorie), guides mis en avant en premier.
- Page **/guides/<slug>** : image de couverture, catégorie, date (et mise à jour), contenu en Markdown, liens « Retour aux guides » en haut et en bas.
- Guides désactivés ou introuvables : page « Guide introuvable » (404). Erreur réseau : message en français avec bouton « Réessayer ».
- Titre et description propres à chaque page (titre du guide + résumé, image de couverture pour le partage).

## Détails techniques
- `hypertvClient.server.ts` : `getGuideCategories()`, `listGuides(category?)`, `getGuide(slug)` (404 → null) ; `ShopInfo.guides?: { enabled, categoryIds }`. Mini-cache mémoire 5 min par chemin.
- `src/lib/guides.functions.ts` : server functions `getGuidesIndex({ category })` et `getGuideDetail({ slug })` ; vérifient `enabled` (shop + réponse) et lèvent `notFound()` sinon ; `Cache-Control: public, max-age=300`. Tri featured puis date dans `src/lib/guides.ts` (+ test).
- `getShopInfo`/catalogue exposent `guidesEnabled` ; `SiteHeader` reçoit `guidesEnabled` et affiche le lien.
- Routes `src/routes/guides.index.tsx` (filtre via search param `?category=`, `loaderDeps`) et `src/routes/guides.$slug.tsx`, chacune avec `head()`, `errorComponent`, `notFoundComponent`, header + footer.
- Ajout de `react-markdown` + `remark-gfm`, sans `rehype-raw` (HTML brut ignoré) ; styles typographiques via classes Tailwind sur les composants Markdown ; liens externes en `rel="noopener noreferrer"`.
