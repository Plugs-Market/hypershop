# Palette de couleurs du revendeur

Les couleurs de la boutique suivent automatiquement celles définies dans HyperTV › Mes paramètres. Aucun écran de réglage dans Hypershop.

## Ce qui change pour vous
- Fond, cartes, couleur principale, bordures, succès/alerte/erreur prennent les couleurs du panel, dès l'ouverture de la page (pas de clignotement).
- La barre du téléphone (theme-color) prend la couleur de fond du revendeur.
- Si le panel ne répond pas ou envoie une couleur invalide : les couleurs actuelles restent.

## Détails techniques
- `hypertvClient.server.ts` : `ShopInfo` gagne `theme` (11 clés hex) et `cssVariables`.
- Nouveau `src/lib/shop-theme.ts` (pur, testable) : `buildThemeCss(theme)` valide chaque valeur avec `/^#[0-9a-f]{6}$/i` ; si une clé manque ou est invalide → `null`. Le CSS injecté est **reconstruit côté serveur** à partir des valeurs validées (mapping clé → `--background`, `--foreground`, `--card`, `--primary`, `--primary-foreground`, `--primary-glow`, `--muted`, `--border`, `--success`, `--warning`, `--destructive`, plus alias `--card-foreground`, `--popover`, `--ring`, etc.) plutôt que d'injecter tel quel la chaîne `cssVariables`, afin d'empêcher toute injection CSS/HTML. `cssVariables` est lu mais sert seulement de référence.
- `shop.functions.ts` : nouvelle `getShopTheme` (serverFn GET) via `getShopCached()` (cache 5 min), renvoie `{ css, background } | null`, erreurs → `null`.
- `__root.tsx` : `loader` appelle `getShopTheme` ; `head({ loaderData })` ajoute `styles: [{ id: "shop-theme", children: css }]` (rendu après le lien styles.css) et `theme-color` = background (repli `#1a1214`).
- Aucun changement de classes dans les composants ; vérification par `rg` qu'aucune couleur en dur n'existe, correction si trouvée. Dégradés et ombre inchangés.
- Tests `src/test/shop-theme.test.ts` : palette valide → CSS ; valeur invalide (`red`, `#fff`, `#12345g`) ou clé manquante → `null`.
- Vérification : curl de la page d'accueil pour voir `<style id="shop-theme">` dans le HTML serveur.
