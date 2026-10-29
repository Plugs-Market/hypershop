# Accélérer la discussion du support

Le chiffrement ne change pas : mêmes clés, même ECDH/AES-GCM, tout reste dans le navigateur. La clé boutique reste dans le proxy côté serveur.

## Ce que verra le client
- La conversation s'affiche tout de suite avec les messages déjà lus sur cet appareil, puis se met à jour en arrière-plan.
- Les nouveaux messages arrivent plus vite, sans recharger tout l'historique.
- Un message envoyé apparaît tout de suite à l'écran.

## Étapes
1. **Cache local par ticket** : les messages déjà déchiffrés sont gardés dans le stockage de l'appareil (IndexedDB) et affichés dès l'ouverture, avec l'état, le sujet, la date de lecture par l'équipe et l'ETag du ticket. Le cache est vidé avec les appareils à la déconnexion.
2. **Premier chargement** : `GET /account/support/tickets/{id}?deviceId=…&include=devices`. La liste des appareils sert seulement à envelopper la clé pour les nouveaux appareils de l'équipe, comme aujourd'hui. Si le cache existe, on demande seulement les messages après le dernier en cache (`after`).
3. **Clé du ticket en mémoire** : une fois déchiffrée, la CryptoKey (non exportable) reste en mémoire pour ce ticket, donc pas de nouvel échange ECDH à chaque lecture. Le cache actuel en mémoire est conservé.
4. **Lectures suivantes** (SSE `message`/`read`/`status` ou sondage de secours) :
   - `GET …?deviceId=…&after=<createdAt du dernier message affiché>`, sans `include=devices`.
   - En-tête `If-None-Match` avec le dernier ETag de ce ticket ; une réponse 304 = rien de nouveau, on ne fait rien.
   - On met à jour l'état et `staffReadAt`, on ajoute les nouveaux messages sans doublon (par id), et on déchiffre seulement les nouveaux.
   - Les lectures sont sérialisées pour que deux événements proches ne lancent pas deux requêtes en même temps.
5. **Envoi optimiste** : le message envoyé s'affiche tout de suite (texte et photos déjà connus en clair), puis une lecture avec `after` remplace la version provisoire par le vrai message (dédoublonnage par id). Le message provisoire est retiré si l'envoi échoue.

## Détails techniques
- `hypertvClient.server.ts` : `call()` accepte des en-têtes supplémentaires et renvoie l'ETag ; en cas de 304, on renvoie `{ notModified: true }` sans lire de JSON. `supportTicket` reçoit `{ after, includeDevices, etag }`.
- `support.functions.ts` / `getSupportTicket` : validation de `includeDevices` et `etag` (longueur limitée), renvoie `{ notModified }` ou `{ ...detail, etag }`. Toujours sans cache (`no-store`).
- `sendSupportMessage` renvoie l'id/createdAt du message si l'API les fournit, pour faire le lien avec la version provisoire.
- `support-crypto.ts` : nouveau magasin IndexedDB `ticketCache` (lecture, écriture, vidage) qui contient uniquement le texte déchiffré de cet appareil.
- `support-client.ts` / `loadTicket` : gère les appareils seulement au premier chargement, plus l'ETag et le 304.
- Page de conversation : affichage du cache d'abord, curseur `after` = dernier `createdAt` affiché, ajout du message provisoire.
- Tests : fusion par id sans doublon, curseur `after`, 304 sans effet, validation des paramètres du serveur.
