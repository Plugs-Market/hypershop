## Ajouter au README un guide « Déployer votre boutique revendeur »

Réécrire le README en français, avec une partie claire pour les revendeurs.

### Contenu
1. **Présentation** : à quoi sert la boutique (catalogue, paiement, activation automatique, espace client, guides, support chiffré). Le nom, le logo, les couleurs et les prix viennent de votre panel revendeur HyperTV.
2. **Bouton « Remix sur Lovable »** qui pointe vers le lien de remix fourni (`https://lovable.dev/projects/04784d22-f96a-45c9-a8ec-e16e5fe48e57/remix`).
3. **Étape 1 – Remixer** : créer ou se connecter à un compte Lovable, ouvrir le lien, cliquer sur Remix. On obtient une copie à soi.
4. **Étape 2 – Activer Lovable Cloud** si on le demande (base de données nécessaire au suivi sécurisé des commandes). Les tables se créent toutes seules.
5. **Étape 3 – Ajouter la clé revendeur `HYPERTV_SHOP_KEY`** :
   - où la récupérer (panel revendeur HyperTV, section API / clé boutique) ;
   - comment l'ajouter (Paramètres du projet → Cloud → Secrets → nom exact `HYPERTV_SHOP_KEY`, ou demander à l'agent « ajoute mon secret HYPERTV_SHOP_KEY ») ;
   - ne jamais la coller dans le code, le chat ni GitHub ; la régénérer si elle a été exposée.
6. **Étape 4 – Publier** : bouton Publish → adresse `xxx.lovable.app`. Rappeler qu'il faut republier après chaque modification de code ou de clé pour la version en ligne.
7. **Étape 5 – Ajouter son domaine** : Paramètres du projet → Domaines → Connecter un domaine. Ajouter chez le registraire les enregistrements DNS indiqués (A vers l'IP donnée par Lovable, TXT de vérification), attendre la propagation (jusqu'à 72 h), le certificat HTTPS se crée tout seul. Formule Lovable payante requise. Déclarer aussi ce domaine dans le panel revendeur HyperTV si le panel le demande.
8. **Vérification finale** : liste de contrôle (nom/logo affichés, formules visibles, commande test, connexion client).
9. **Dépannage** : boutique vide ou erreur → clé absente/incorrecte ou pas republiée ; domaine inactif → DNS pas encore propagé.
10. Garder ensuite la partie « Développement local » actuelle et retirer la ligne parasite « Implémenter exactement la capture d'écran… ».

### Détail technique
Seul `README.md` est modifié. La seule clé à fournir est `HYPERTV_SHOP_KEY` (lue côté serveur dans `src/lib/hypertvClient.server.ts`) ; les autres valeurs du backend sont créées automatiquement par Lovable Cloud.
