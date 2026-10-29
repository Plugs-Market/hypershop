# Optimiser le site pour l'installation sur iPhone et Android

Objectif : quand un client choisit lui-même « Ajouter à l'écran d'accueil », l'icône affiche le logo de votre panel revendeur et le nom de votre boutique. Aucun popup, bannière ni message d'installation n'est ajouté.

## Ce qui change
- L'icône sur l'écran d'accueil = logo du panel revendeur (comme dans l'en-tête).
- Le nom sous l'icône = titre de la boutique renvoyé par l'API.
- L'app s'ouvre en plein écran (sans barre du navigateur), avec les couleurs sombres/rouges de la boutique.
- Si vous changez logo ou nom dans le panel, les nouvelles installations suivront automatiquement.
- Pas de mode hors ligne (non demandé), donc aucun risque de version bloquée.

## Détails techniques
- Route serveur `/manifest.webmanifest` générée dynamiquement via `getShop()` (name, short_name, description = slogan, display standalone, start_url "/", theme/background color du thème, icônes).
- Route serveur `/app-icon/$size.png` : récupère `logoUrl` côté serveur (même règles d'allowlist/limites que les autres téléchargements), sert l'image avec cache ; repli sur une icône par défaut si pas de logo. Tailles 180 (Apple), 192, 512 (Android, dont `purpose: any maskable`).
- `__root.tsx` head : `link rel=manifest`, `apple-touch-icon`, `meta theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` (nom boutique), `mobile-web-app-capable`, status bar `black-translucent`, viewport `viewport-fit=cover` + safe-area padding dans header/footer.
- Favicon dérivé du même logo ; suppression de `public/favicon.ico`.
- Aucun service worker, aucun `beforeinstallprompt`, aucun message d'installation.
- Note : iOS/Android mémorisent l'icône au moment de l'installation ; un changement de logo nécessite de réinstaller.
