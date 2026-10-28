# Boutique HyperTV — pont de revente

Boutique en français, thème sombre moderne avec accent rouge. Elle vend les formules HyperTV et active automatiquement les clients via l'API. Aucun back-office de gestion clients/crédits.

## Étape 0 — Mise en place
- Activer Lovable Cloud.
- Demander la clé `HYPERTV_SHOP_KEY` (format `htv_shop_...`) via le formulaire sécurisé.
- Connexion admin par email/mot de passe ; rôle admin stocké dans une table de rôles séparée (le premier compte sera promu admin manuellement).

## Étape 1 — Liaison test
- Module serveur unique `hypertvClient.server.ts` : `getOffers`, `getBalance`, `getCustomers`, `activate` (timeout 15 s, erreurs typées, clé jamais logguée ni renvoyée).
- Traduction de chaque code d'erreur API en message clair français.
- Page `/test-api` (admin uniquement) : état connexion, solde, formules, clients, formulaire d'activation test (MAC + formule) avec réponse brute.

## Étape 2 — Boutique publique
- Accueil `/` : formules depuis `/offers` (nom, durée, écrans) + prix de vente boutique. Formules sans prix = masquées.
- Page `/admin/prix` : l'admin fixe le prix public par formule.
- Tunnel `/commander/$planId` : MAC (validée `XX:XX:XX:XX:XX:XX`, aide « Profil de l'app HyperTV »), email, formule → crée la commande.
- Page de suivi `/commande/$id` (lien unique, id UUID non devinable) : statut paiement, statut activation, date d'expiration.
- Paiement : emplacement prévu pour Stripe ; bouton « Simuler le paiement » visible et autorisé uniquement pour l'admin (vérifié côté serveur).
- Après paiement confirmé côté serveur : `POST /activate` avec `idempotencyKey = id commande`, résultat enregistré. En cas de 409 / erreur réseau : statut « en cours », réessai avec la même clé (bouton « Réessayer » + nouvel essai automatique à l'ouverture du suivi). Une commande déjà activée n'est jamais relancée.

## Détails techniques
- Tables : `products` (plan_id unique, price_cents, active), `orders` (id uuid, email, mac, plan_id, plan_name, price_cents, payment_status, activation_status, api_response jsonb, expires_at, idempotency_key, timestamps), `user_roles` + `has_role`.
- RLS : `products` lecture publique, écriture admin ; `orders` sans accès direct client — lecture/écriture via server functions (lecture par id pour le suivi, admin pour simuler le paiement).
- Tout appel API HyperTV dans `createServerFn` ; jamais depuis le navigateur.
- Test unitaire : validation MAC et traduction des erreurs.
