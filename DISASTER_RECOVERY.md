# Disaster Recovery V3

## Objectifs

- RPO cible: 24 h tant que le plan Supabase ne garantit pas mieux.
- RTO cible: 4 h pour les fonctions essentielles.
- Priorite: identite, liens famille, progression, presences, rapports, finance, messages.

## Avant Toute Migration

1. Geler les mutations administratives.
2. Creer un backup/snapshot et verifier sa date/taille.
3. Exporter les comptages de controle.
4. Taguer le commit stable et noter migrations/version PWA.
5. Executer la migration en staging, puis les sanity checks.

## Panne Base

Mettre l'interface en lecture/offline lorsque possible, ne jamais simuler une sauvegarde, conserver la queue locale, verifier le statut Supabase, restaurer sur un projet isole puis comparer les comptages avant bascule.

## Suppression Accidentelle

Suspendre les ecritures, identifier l'heure et l'acteur via audit, restaurer le snapshot dans un environnement separe, extraire les lignes concernees, valider a deux personnes, reimporter transactionnellement.

## Migration Ratee

Ne pas relancer aveuglement. Conserver l'erreur, verifier si la transaction a rollback, appliquer le script de verification, utiliser le rollback documente ou restaurer le snapshot. La production reste sur V1 si la bascule V3 n'est pas validee.

## Compte Privilegie Compromis

Suspendre le compte, revoquer sessions/MFA, tourner les secrets susceptibles d'etre exposes, examiner audit et uploads, restaurer les permissions minimales, documenter l'incident.

## Deploiement Defectueux

Revenir au tag stable, ne pas annuler une migration destructive sans preuve, desactiver le module via feature flag si possible, purger/versionner le service worker, verifier les cinq parcours critiques.

## Exercice

Test de restauration trimestriel sur donnees anonymisees. Conserver date, duree, ecarts, responsable et actions correctives.
