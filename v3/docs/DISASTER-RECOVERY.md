# Reprise après incident et sauvegardes

## Périmètre réel

Chaque archive contient un export PostgreSQL du schéma métier `public` au format `pg_dump` et les objets Supabase Storage accessibles au compte de service, avec chemins, tailles et empreintes SHA-256. L'archive est chiffrée avec AES-256-CBC + PBKDF2 et protégée contre la modification par une signature HMAC-SHA-256 distincte.

Les archives ne couvrent pas les secrets Vercel/GitHub, les paramètres de projet Supabase, les clés de signature, les paramètres Auth ni les identités `auth.users` garanties par un export logique standard. Une reprise complète rétablit aussi ces éléments depuis le coffre de secrets.

## Politique cible

- Quotidien : 7 versions.
- Hebdomadaire : 6 versions.
- Mensuel : 13 versions environ.
- Avant une migration : exécuter manuellement `daily-encrypted-backup.yml`.
- Stockage : bucket S3 compatible, privé, distinct de DARALQURAN, avec versionnage et cycle de vie à 400 jours.

GitHub Actions ne conserve jamais le contenu d'une sauvegarde. Il n'exécute et journalise que le résultat. Les clés de chiffrement et d'intégrité doivent être séparées du bucket et disponibles à au moins deux responsables autorisés via un coffre de mots de passe.

## Activation unique de la sauvegarde quotidienne

Configurer dans les secrets GitHub du dépôt, sans jamais les inscrire dans Git :

`DARALQURAN_BACKUP_DATABASE_URL`, `DARALQURAN_SUPABASE_URL`, `DARALQURAN_SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_INTEGRITY_KEY`, `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` et, si nécessaire, `BACKUP_S3_ENDPOINT`.

Le bucket doit être privé et hors de l'infrastructure de production. Exécuter une fois `scripts/configure-backup-s3-lifecycle.sh` avec les mêmes identifiants AWS/S3 pour poser la rétention. Le workflow planifié `daily-encrypted-backup.yml` échoue explicitement si l'un de ces secrets manque : il ne peut donc pas annoncer une sauvegarde inexistante.

## Répétition de restauration

La procédure ne cible jamais DARALQURAN. `scripts/restore.sh` refuse le project ref `mdgofogpghlwesaduxrq`, exige `RESTORE_ISOLATED_TARGET=YES`, puis valide la signature et les empreintes avant de lancer `pg_restore`.

Dans GitHub Actions, `isolated-backup-restore.yml` démarre un Supabase local vide, produit une archive chiffrée, vérifie qu'une archive modifiée est rejetée, puis restaure dans une base locale dédiée et contrôle les tables critiques. Cette répétition ne copie aucune donnée personnelle de DARALQURAN.

## Reprise de production

1. Déclarer l'incident et préserver la base affectée pour analyse.
2. Activer la maintenance applicative sans effacer de données.
3. Créer un projet/base de remplacement isolé.
4. Vérifier la signature de l'archive choisie et restaurer la base de remplacement.
5. Réimporter les objets Storage avec contrôle des empreintes du manifeste.
6. Recréer les éléments de configuration non couverts : Auth, secrets et paramètres du projet.
7. Vérifier RLS, `/ready`, puis les parcours direction, professeur et élève.
8. Effectuer le basculement contrôlé des secrets Vercel et surveiller la production trente minutes.

Un test de restauration ou un changement de secrets ne doit jamais cibler la base officielle.
