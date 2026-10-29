# Support HyperTV chiffré dans l'espace client

Les clients connectés discutent avec le revendeur et l'équipe HyperTV. Tout est chiffré dans le navigateur : ni la boutique ni HyperTV ne lisent les messages.

## Écrans
- **Mon compte** : nouveau bouton « Support ».
- **/mon-compte/support — Mes demandes** : sujet déchiffré, catégorie, date, badge (Ouvert, En attente de vous, Résolu, Fermé), point rouge si l'équipe a répondu en dernier. Bouton « + » désactivé avec « Le support est réservé aux abonnés » si création impossible.
- **Nouvelle demande** (fenêtre) : catégorie (Compte, Abonnement, Lecture, Paiement, Autre), sujet, message.
- **/mon-compte/support/{id} — Conversation** : bulles client à droite, équipe à gauche, événements de statut centrés, « Lu » sous le dernier message lu, envoi avec Entrée (Maj+Entrée = retour ligne), jusqu'à 6 photos de 10 Mo (aperçu, déchiffrées à l'affichage, agrandissables). Boutons « Résolu » / « Non résolu » avec confirmation ; jamais « Fermer ».
- Mises à jour en direct ; repli automatique toutes les 3 s.
- Erreurs : session expirée → /connexion ; réservé aux abonnés → message dédié ; demande introuvable → page « introuvable » ; statut changé entre-temps → rechargement.
- À la déconnexion, la clé de chiffrement de l'appareil est effacée.

## Détails techniques
- `hypertvClient.server.ts` : endpoints /account/support/* (devices, tickets, keys, messages, attachments, status, read) avec session client ; flux SSE en `fetch` brut.
- `src/lib/support.functions.ts` : server functions (session HttpOnly obligatoire, no-store, validation zod, ids/paths bornés) ; aucun contenu en clair ne transite.
- Route serveur `src/routes/api/support-stream.ts` : lit le cookie de session, relaie le SSE HyperTV (événements sans contenu) ; 401 si non connecté.
- `src/lib/support-crypto.ts` (navigateur, WebCrypto) : paire ECDH P-256 non exportable stockée dans IndexedDB par client (clé = id client), enregistrement de l'appareil → deviceId ; clé ticket AES-256-GCM ; wrap/unwrap ECDH → HKDF-SHA256 → AES-GCM ; chiffrement {t,n?,atts} et photos ; base64 ; ré-enveloppement pour les nouveaux appareils à chaque lecture.
- Upload : POST /attachments puis PUT direct du chiffré sur uploadUrl depuis le navigateur ; lecture via URL signée puis déchiffrement en blob URL (révoquées).
- `src/lib/support.ts` : catégories/statuts traduits, tri, logique « Lu », erreurs.
- Routes non imbriquées `mon-compte_.support.tsx` et `mon-compte_.support_.$id.tsx`, données chiffrées hors cache SSR, `noindex`, en-têtes no-store ajoutés dans `server.ts`.
- Cookie de session : aucun changement ; clé IndexedDB supprimée dans `onLogout`.
- Tests : aller-retour chiffrement (wrap/unwrap, message, photo), mapping statuts/erreurs, logique « Lu », server functions (session requise).
- AGENTS.md : règle « chiffrement support uniquement navigateur, serveur = proxy aveugle ».
