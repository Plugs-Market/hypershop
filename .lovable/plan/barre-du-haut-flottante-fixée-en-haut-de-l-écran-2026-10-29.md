# Barre du haut flottante, fixée en haut de l'écran

## Ce qui change
- La barre du haut (logo + boutons) reste toujours collée en haut de l'écran, sur toutes les pages, y compris dans l'app installée sur iPhone (elle passe sous l'heure et la batterie sans être cachée).
- Style flottant : une barre aux coins arrondis, légèrement détachée des bords, fond semi-transparent flouté et une ombre légère. Elle reste centrée et limitée à la largeur maximale du site sur grand écran.
- Mobile : plus compacte (logo et boutons-icônes un peu plus petits, nom de la boutique coupé proprement s'il est trop long) pour que les 4 boutons tiennent sur une ligne.
- Le contenu des pages commence sous la barre, rien n'est caché derrière.
- Page de discussion du support : même barre flottante en haut, la zone d'envoi reste fixée en bas, seuls les messages défilent.

## Détails techniques
- SiteHeader : `header` passe en `fixed inset-x-0 top-0 z-50` avec `pt-[env(safe-area-inset-top)]` ; conteneur intérieur `mx-auto max-w-6xl mx-2 sm:mx-4 mt-2 rounded-2xl border bg-background/75 backdrop-blur shadow-lg`, padding `py-2 sm:py-3`.
- Disposition : `grid grid-cols-[minmax(0,1fr)_auto]` mobile, nom en `truncate`, logo et icônes `shrink-0`, boutons `h-9 w-9` sur mobile.
- Espace réservé : un bloc vide de la hauteur de la barre (+ zone sûre) rendu juste après le header, pour que les pages et le shell de conversation (qui fait déjà `pt-[env(safe-area-inset-top)]`, à retirer pour éviter le doublon) gardent leur mise en page.
- Uniquement des jetons de couleur du thème, aucun changement de logique.
- Vérification Playwright en 393x706 et 1280x1800 : barre visible après défilement, contenu non masqué.
