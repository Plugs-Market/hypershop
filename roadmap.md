# Intégration HYPER VOD
- [x] Catalogue et commande HYPER VOD, prix API et démos sans paiement.
- [x] Livraison privée, historique et secours support.
- [x] 96 tests ciblés validés ; catalogue réel HTTP 200 et aucune offre HYPER VOD, aucun achat effectué.
- [ ] Vérification réelle du parcours HYPER VOD — aucune offre HYPER VOD renvoyée par HyperTV et aucune commande propriétaire disponible.

# Intégration TREX
- [x] Catalogue TREX OTT / STRONG 8K corrigé, contenu API conservé, caches invalidés et erreurs avec réessai ; HTTP 200 réel, 5 TREX et 2 STRONG 8K, images et accès aux pages de commande vérifiés sans achat.
- [x] Intégrer 8KPRO dans le catalogue et le parcours TREX partagé ; tests catalogue, commandes, factures et confidentialité validés, sections vides masquées dans l’aperçu.
- [ ] Vérifier un achat et une livraison STRONG 8K réels — accord préalable nécessaire pour tout achat ; aucun achat effectué.
- [x] Exclure les commandes déjà livrées de toute création automatique de ticket, y compris la reprise de brouillons et l'appel serveur ; 67 tests ciblés validés.
- [x] Unifier les tickets chiffrés de commande, leur reprise sans doublon et les boutons LION/TREX dans le suivi et les factures ; 58 tests ciblés validés.
- [ ] Vérifier les six parcours tickets sur des commandes réelles, dont une ancienne commande déjà livrée ; bloqué par l’absence de session client HyperTV, redirection vers connexion vérifiée.
- [x] Discussion support : réponse fixe, messages seuls défilants, barre supérieure compacte et aucun pied de page ; compilation et 6 tests support validés.
- [x] Espacement discussion/réponse réduit à 8 px pour les discussions courtes ; disposition isolée contrôlée en 390 × 844 et 1280 × 1800, seuls les messages défilent.
- [ ] Vérification visuelle de la discussion connectée — session client HyperTV indisponible dans l’aperçu de test, redirection vers connexion constatée.
- [x] Mes factures : liste privée, filtres, détails, paiement, annulation et tests ; redirection des visiteurs vérifiée.
- [ ] Essai connecté de Mes factures avec une facture réelle — session client HyperTV indisponible dans l’aperçu de test ; aucun paiement ni annulation réel effectué.
- [x] Accès M3U/Xtream privés et dates TREX depuis delivery.
- [x] Preuve propriétaire serveur et téléchargement fournisseur protégé ; anciennes commandes sans preuve exclues.
- [x] Tests autorisation, états et contenu M3U ; copie et affichage mobile vérifiés sur une commande gratuite activée avec preuve de test retirée ensuite.
- [x] Catalogue et badges TREX depuis l’API revendeur.
- [x] Achat exclusif planId ou trexPlanId et clé conservée lors des réessais réseau.
- [x] Suivi TREX, timeline et erreurs traduites avec interrogation continue.
- [x] Tests ciblés et vérification du catalogue/parcours sans paiement réel.
- [ ] Vérification réelle d’une commande en attente et d’un nouvel achat activé — aucune commande en attente disponible, essai gratuit déjà utilisé ; tests automatisés couvrent ces états et aucun paiement réel n’a été effectué.