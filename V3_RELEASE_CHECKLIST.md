# V3 Release Checklist

> Le socle local est candidat staging. La production reste bloquee tant que les controles marques staging/operateur ne sont pas prouves.

## Durcissement Production

- [x] Threat model et registre de risques.
- [x] Acces aux espaces refuse par role cote serveur.
- [x] Permissions extensibles et feature flags en base.
- [x] Recu serveur idempotent pour mutations offline.
- [x] Mise a jour PWA controlee et purge des caches versions precedentes.
- [x] CSP et en-tetes de securite.
- [x] Error boundaries et diagnostic technique direction.
- [x] CI: secret scan, audit dependances, lint, types, tests, build et E2E.
- [ ] Staging: backup puis restauration exercee.
- [ ] Staging: charge 1 000 eleves/100 professeurs/historiques.
- [ ] Staging: alertes/monitoring sans PII.

Date de validation locale : 2026-08-31  
Décision actuelle : **GO pour déploiement en staging, NO-GO pour bascule production avant les contrôles live ci-dessous.**

## Terminé

- [x] Architecture Next.js, TypeScript et Supabase V3 additive, sans modification destructive de la V1.
- [x] Auth Supabase, rôles, statuts, RLS et MFA TOTP obligatoire pour admin/direction.
- [x] Site public multilingue, espaces élève/famille/professeur, mode séance et e-Mawahib Command.
- [x] Messagerie : conversations, membres, non-lu, recherche, archivage, historique et relations autorisées.
- [x] Pièces jointes privées : allowlist, limite 10 Mo, SHA-256, chemin non prévisible et URL signée 60 secondes.
- [x] Demandes séparées : référence, type, priorité, assignation, workflow et chronologie.
- [x] Notifications in-app Realtime, préférences et notifications navigateur lorsque l’application est active.
- [x] PWA, manifest, cache Coran et cache audio borné à 24 fichiers.
- [x] File IndexedDB idempotente, retry automatique, état non synchronisé et conservation des conflits.
- [x] Limitation des tentatives de connexion, des messages et des interactions publiques.
- [x] Scripts V1 comptes/apprentissage/bundle complet avec quarantaine et conversion des anciens préfixes métier.
- [x] Audit logs sur conversations et changements de demandes.

## Tests Exécutés

- [x] Lint et typecheck.
- [x] Vitest : 50/50 tests, dont 25/25 migrations/RLS et refus admin sans MFA `aal2`.
- [x] Build production Next.js réussi.
- [x] Playwright complet : 75/75 sur Chrome desktop, iPad Mini et Pixel 5.
- [x] Trois scénarios supplémentaires de coupure réseau IndexedDB réussis sur desktop, tablette et mobile.
- [x] Parcours couverts : public, langues, auth/RLS, élève, famille, professeur, mode séance, rapport, admin, messagerie, demande, suspension, progression, replay, actualité et offline.

## Contrôles Staging Obligatoires

- [ ] Appliquer les migrations sur un Supabase staging, jamais directement sur production.
- [ ] Régénérer les types avec `supabase gen types typescript` et contrôler la dérive.
- [ ] Tester un vrai compte par rôle et les statuts pending, suspended et archived.
- [ ] Enrôler deux comptes admin/direction en MFA et tester récupération du facteur.
- [ ] Tester upload/téléchargement de chaque type de pièce jointe.
- [ ] Vérifier Realtime avec deux appareils simultanés.
- [ ] Tester Coran/audio hors connexion sur Android, iPhone/iPad et appareil ancien.
- [ ] Répéter la migration sur une copie complète V1 et vider `sections.review`.
- [ ] Comparer les totaux V1/V3 : comptes, liens, progressions, devoirs, historiques et messages utiles.
- [ ] Vérifier une sauvegarde Supabase et effectuer un exercice de restauration.

## Restant / Risques

- Les notifications navigateur sont déclenchées par Realtime lorsque l’application est ouverte. Le Web Push lorsque l’application est totalement fermée nécessite encore un expéditeur VAPID/Edge Function et ses secrets.
- Le binaire SWC natif Windows de ce poste est invalide. Next utilise le fallback WASM et le build réussit ; le CI Linux doit rester la référence de release.
- Aucun test local ne remplace un smoke test réel Supabase Auth, Storage et Realtime.
- Le bundle de migration refuse les formats ambigus. Toute ligne en quarantaine doit être résolue, jamais forcée.

## Sécurité

- [x] Aucun secret serveur exposé au frontend.
- [x] Service role uniquement dans les routes serveur.
- [x] RLS sur toutes les tables publiques métier ; mutations via RPC contrôlées.
- [x] Contenus utilisateurs échappés par React, sans injection HTML.
- [x] Contrôle same-origin sur les API mutantes.
- [x] Uploads allowlistés, bornés, privés et servis par URL signée.
- [x] MFA admin/direction appliquée aux pages et API administratives.
- [x] Audit logs append-only limités aux rôles autorisés.

## Bascule Production

1. Geler les écritures V1 pendant la fenêtre annoncée.
2. Créer une sauvegarde vérifiée et noter le point de restauration.
3. Exécuter la migration staging finale et signer les totaux.
4. Appliquer les migrations production, puis migrer avec un identifiant de lot unique.
5. Exécuter les smoke tests auth, rôles, MFA, progression, messagerie, pièces jointes, séance et admin.
6. Basculer le routage uniquement si tous les contrôles critiques sont verts.
7. Conserver la V1 en lecture seule pendant l’observation.

## Rollback

1. Remettre le routage vers la V1.
2. Ne jamais supprimer les données V3 produites après la bascule.
3. Marquer le lot `rolled_back` dans `private.migration_batches`.
4. Exporter les écritures V3 postérieures au lot avant correction.
5. Restaurer uniquement depuis la sauvegarde vérifiée si l’intégrité globale est atteinte.
6. Corriger en staging, répéter tous les tests, puis planifier une nouvelle bascule.

La production ne doit jamais être basculée automatiquement par un script de migration ou de déploiement.
