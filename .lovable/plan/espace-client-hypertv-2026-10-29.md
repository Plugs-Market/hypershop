# Espace client HyperTV

Les clients se connectent avec leur clé d'accès HyperTV (aucun compte créé dans la boutique : tout vient de l'API revendeur).

## Pages
- **/connexion** : champ « Clé d'accès HyperTV » (xxxxx-xxxxx-xxxxx, majuscules auto). Si l'API demande la double authentification, un 2e champ « Code à 6 chiffres (Google Authenticator) » apparaît. Succès → /mon-compte. Si déjà connecté → /mon-compte.
- **/mon-compte** : pseudo modifiable + « Enregistrer » (2–30 caractères : lettres, chiffres, espace, _ . -), grade, date d'inscription, abonnement (« Abonné jusqu'au JJ/MM/AAAA » ou « Aucun abonnement actif »), nombre de playlists, MAC MAG + bouton copier, bouton « Renouveler » (boutique avec MAC pré-remplie), bouton « Déconnexion » avec confirmation.
- Session expirée/invalide → cookie supprimé, retour à /connexion.

## En-tête et commande
- Lien « Connexion » (icône seule sur mobile) ou « Mon compte » selon l'état.
- Au checkout, la MAC du client connecté (ou celle passée par « Renouveler ») est pré-remplie, toujours modifiable.

## Messages d'erreur
invalid_key « Clé inconnue », invalid_code « Code incorrect », mfa_token_invalid « Délai dépassé, recommencez », too_many_attempts « Trop de tentatives, réessayez plus tard », plus messages génériques réseau.

## Détails techniques
- `hypertvClient.server.ts` : `call()` accepte un en-tête `X-Customer-Session` ; ajout `login`, `loginMfa`, `getAccount`, `updateAccount`, `logout`.
- Nouveau `src/lib/account.functions.ts` (server functions) + `account.server.ts` (cookies) : `htv_customer` (httpOnly, Secure, Lax, 7 j), `htv_mfa` (httpOnly, 5 min). Clé d'accès jamais stockée ni loguée.
- `src/lib/account.ts` (partagé) : normalisation de la clé, validation pseudo (zod), traduction des erreurs.
- Routes `connexion.tsx`, `mon-compte.tsx` (loader serveur, redirection si non connecté, `no-store`), head() propres, `noindex`.
- `accountStatus` léger (connecté oui/non + MAC) pour l'en-tête et le checkout ; `commander.$planId` accepte un paramètre `mac` optionnel.
- Mise à jour de la règle AGENTS.md « No accounts » → espace client en lecture via API, aucun compte local.
- Tests : normalisation de la clé, validation du pseudo, traduction des erreurs.
