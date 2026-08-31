# Migration V1 vers V3

Avant/apres chaque bascule, exporter les comptages `users`, `students`, `teachers`, `progressions`, `classes` et `messages`, puis executer `npm run migration:v1:verify -- --before before.json --after after.json`. Un resultat SQL sans erreur ne suffit pas: toute diminution bloque la bascule et declenche la procedure de reprise.

La migration est additive. La V1 reste en lecture seule pendant la répétition et aucune table V1 n'est supprimée.

## Règle non négociable

La V1 reste en ligne et inchangée tant qu'une tranche V3 n'a pas réussi la réconciliation des données, les tests d'autorisation, la recette utilisateur et un exercice de rollback. La branche V3 ne remplace jamais automatiquement le site GitHub Pages de production.

## État V1 constaté

L'audit a trouvé une application statique d'environ 142 pages HTML, 22 fichiers JavaScript et 14 feuilles de style. Plusieurs fichiers dépassent 1 300 lignes. Les concepts métier sont répartis entre l'état navigateur et des tables Supabase larges. La table V1 `messages` transporte aussi des rapports, séances, devoirs, finances et récitations au moyen de préfixes textuels.

Les tables rencontrées incluent notamment `eleves`, `profs`, `profils_admin`, `progressions`, `devoirs`, `horaires`, `messages`, `parent_feedback`, `school_classes`, `class_students`, `school_messages`, `student_admin_profiles` et `admin_audit_logs`. Cet inventaire doit être confirmé par un export en lecture seule : le code constitue une preuve, pas le schéma de production définitif.

## Préparation

1. Exporter séparément comptes, progressions, professeurs, relations, devoirs, données administratives, messages et historiques.
2. Exécuter `npm run migration:v1:prepare`, puis `npm run migration:v1:learning` pour les contrôles spécialisés.
3. Exécuter `npm run migration:v1:complete -- export-v1.json bundle-v3.json` pour produire le bundle global et le rapport de quarantaine.
4. Examiner obligatoirement `sections.review` et les compteurs avant toute écriture.

Les mots de passe V1 et les identifiants bruts ne sont jamais copiés. Les comptes sont créés dans Supabase Auth avec réinitialisation obligatoire. Les messages préfixés `HOMEWORK`, `SESSION_REPORT`, `INCIDENT`, `REQUEST` et équivalents sont convertis vers les tables métier. Les préfixes de cache, synchronisation, version et débogage sont ignorés.

## Chargement contrôlé

- Créer un lot dans `private.migration_batches` avec l'empreinte SHA-256 du bundle.
- Charger les comptes et renseigner `private.legacy_account_links`.
- Résoudre les identifiants V1 vers les UUID V3 avant les relations.
- Charger dans cet ordre : écoles/comptes, classes/affectations, familles, progression, devoirs, séances, demandes, conversations, historique.
- Comparer les totaux source/cible et échantillonner les dossiers avant de marquer le lot `completed`.

## Répétition et retour arrière

Les importations de progression et les écritures hors connexion sont idempotentes. Un retour arrière cible uniquement le `batch_id` du lot, jamais les données créées ensuite par les utilisateurs. La bascule nécessite la validation de `V3_RELEASE_CHECKLIST.md`.

## Séquence de migration

### Fondation

- Isoler V3 sous `/v3` avec TypeScript strict, CI, tests, Supabase SSR, RBAC et RLS.
- Ne changer ni les données ni le routage de production.

### Découverte en lecture seule

- Exporter schéma, politiques, volumes, valeurs nulles, doublons et orphelins.
- Créer une correspondance stable pour chaque élève, parent, professeur et classe.
- Enregistrer empreintes et totaux afin de réconcilier chaque import.

### Identité et personnes

- Provisionner Supabase Auth sans réutiliser les mots de passe V1.
- Importer profils, rôles, liens famille, affectations et statuts.
- Garder les comptes `pending` jusqu'à la réconciliation et imposer un nouveau secret.
- Tester élève, parent, professeur, admin, direction, suspension et multi-rôle.

`npm run migration:v1:prepare -- input.json output.json` produit un artefact sans mot de passe ni identifiant brut. Il exige `V1_MIGRATION_FINGERPRINT_KEY` et utilise une empreinte HMAC pour les doublons.

### Noyau scolaire

- Migrer écoles, classes, inscriptions, horaires, présences et séances.
- Garder V1 comme source d'écriture jusqu'à validation des modèles V3.
- Ne mettre en place un double-write qu'après tests de rejeu et rollback.

### Apprentissage du Coran

- `npm run quran:extract-v1` valide exactement 114 sourates et 6 236 versets séquentiels.
- `npm run migration:v1:learning -- progressions.json prepared.json` normalise les progressions.
- `import_v1_learning_progress` conserve la charge brute privée, applique des upserts conservateurs et refuse les régressions.
- Réconcilier maîtrise, pourcentage, étapes, étoiles et dates compte par compte.

### Systèmes transverses

- Transformer les préfixes techniques vers conversations, demandes, devoirs, rapports et incidents.
- Importer les retours parents et rapports avec date et statut d'origine.
- Reconstruire la finance comme registre auditable, jamais depuis du texte d'interface.
- Rejouer le delta final par classe avant le changement de source d'autorité.

## Contrôles de préservation

- Les imports portent une source, un identifiant V1, un lot et une empreinte.
- Aucune personne n'est rapprochée par son seul nom d'affichage.
- Chaque lot enregistre source, insertions, mises à jour, rejets et empreinte de contrôle.
- Les lignes ambiguës vont en quarantaine et ne sont jamais ignorées silencieusement.
- Une sauvegarde et un exercice de restauration précèdent la première écriture production.
- Renommer une personne ou changer son mot de passe ne crée jamais une nouvelle identité d'apprentissage.

## Définition de « migré »

Une tranche est migrée seulement lorsque schéma, RLS, import, réconciliation, tests automatisés, parcours mobile, observabilité, procédure opérateur et rollback ont été démontrés. Une ressemblance visuelle ne constitue pas une migration.
