# Hypershop — Boutique revendeur HyperTV

Boutique en ligne prête à l'emploi pour les revendeurs HyperTV : catalogue d'abonnements HyperTV et TREX, paiement (crypto, PayPal, carte), activation automatique, espace client, factures, guides et support chiffré de bout en bout.

Le **nom, le logo, le slogan, les couleurs, les formules et les prix** viennent automatiquement de votre **panel revendeur HyperTV**. Vous n'avez rien à coder.

👉 **[Remixer ce projet sur Lovable](https://lovable.dev/projects/04784d22-f96a-45c9-a8ec-e16e5fe48e57/remix)**

**Démo** : [shop.hypertv.win](https://shop.hypertv.win)

---

## Déployer votre boutique en 5 étapes

### Étape 1 — Remixer le projet

1. Créez un compte sur [lovable.dev](https://lovable.dev) (ou connectez-vous).
2. Ouvrez ce lien : **https://lovable.dev/projects/04784d22-f96a-45c9-a8ec-e16e5fe48e57/remix**
3. Cliquez sur **Remix**. Vous obtenez votre propre copie de la boutique, qui vous appartient.

### Étape 2 — Activer Lovable Cloud

Si Lovable vous le propose, activez **Lovable Cloud**. Il sert à sécuriser le suivi des commandes et les accès IPTV de vos clients. Les tables nécessaires se créent toutes seules.

### Étape 3 — Ajouter votre clé revendeur `HYPERTV_SHOP_KEY`

Sans cette clé, la boutique reste vide.

1. Dans votre **panel revendeur HyperTV**, ouvrez la section **API / Clé boutique** et copiez votre clé.
2. Dans votre projet Lovable, ouvrez **Paramètres du projet → Cloud → Secrets**.
3. Ajoutez un secret nommé exactement **`HYPERTV_SHOP_KEY`** et collez votre clé comme valeur.

   Autre solution : écrivez dans le chat Lovable « Ajoute mon secret HYPERTV_SHOP_KEY ». Un formulaire sécurisé s'ouvre pour la saisir.

> ⚠️ **Ne collez jamais cette clé** dans le code, dans un message du chat ou sur GitHub. Elle reste côté serveur et n'est jamais envoyée aux visiteurs. Si elle a été exposée, régénérez-la tout de suite dans votre panel HyperTV.

### Étape 4 — Publier

1. Cliquez sur **Publish** (en haut à droite sur ordinateur, en bas à droite sur mobile).
2. Votre boutique est en ligne sur une adresse du type `votre-boutique.lovable.app`.

Après chaque modification du code ou de la clé, cliquez de nouveau sur **Publish → Publish changes** pour mettre à jour la version en ligne.

### Étape 5 — Ajouter votre nom de domaine

*(Nécessite une formule Lovable payante.)*

1. Ouvrez **Paramètres du projet → Domaines → Connecter un domaine** (ou passez par la fenêtre **Publish**).
2. Saisissez votre domaine, par exemple `shop.mondomaine.com`.
3. Chez votre registraire (OVH, Cloudflare, GoDaddy…), ajoutez les enregistrements DNS que Lovable vous indique :
   - un enregistrement **A** vers l'adresse IP fournie par Lovable ;
   - un enregistrement **TXT** de vérification.
4. Patientez pendant la propagation DNS (de quelques minutes à 72 h). Le certificat HTTPS est créé automatiquement.
5. Si votre panel revendeur HyperTV vous le demande, déclarez-y aussi ce domaine.

---

## Vérification finale

- [ ] Le nom et le logo de votre boutique s'affichent en haut de page.
- [ ] Les formules HyperTV et TREX apparaissent avec vos prix.
- [ ] Une commande de test crée bien une facture dans votre panel.
- [ ] La page **Connexion** accepte la clé d'accès d'un client.
- [ ] Votre domaine ouvre la boutique en HTTPS.

## Dépannage

| Problème | Solution |
|---|---|
| Boutique vide ou message d'erreur | Vérifiez que le secret s'appelle exactement `HYPERTV_SHOP_KEY` et que la clé est correcte, puis republiez. |
| Les changements n'apparaissent pas en ligne | Cliquez sur **Publish → Publish changes**. |
| Le domaine ne fonctionne pas | Vérifiez les enregistrements DNS et attendez la fin de la propagation. |

---

## Développer avec Lovable

Continuez à faire évoluer votre boutique dans l'éditeur Lovable : décrivez ce que vous voulez et Lovable écrit le code. Chaque modification est synchronisée avec votre dépôt GitHub si vous l'avez connecté.

## Développement local

Il vous faut Node.js et npm ([installation avec nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

```sh
git clone <url-de-ce-depot>
cd <nom-du-depot>
npm i
npm run dev
```
