# Threat Model V3

## Scope

e-Mawahib V3 traite des donnees de mineurs, familles, apprentissage, RH, salaires, messages et documents. Les frontieres de confiance sont le navigateur/PWA, Next.js, Supabase Auth/Postgres/Storage/Realtime et les integrations explicitement autorisees.

## Actifs

Identites et sessions, relations familiales, dossiers pedagogiques, messages, presences, incidents, salaires, documents prives, comptes privilegies, cles serveur, donnees coraniques canoniques et journaux d'audit.

## Menaces Et Controles

| ID | Menace | Impact | Probabilite | Controle principal | Test/preuve |
|---|---|---:|---:|---|---|
| TM-01 | Acces horizontal eleve/parent | Critique | Moyenne | RLS `can_access_student`, liens famille actifs | Tests DB negatifs Student A/B et Parent A/B |
| TM-02 | Professeur hors classe | Eleve | Moyenne | Affectation active requise par RLS/RPC | Test `teacherB` sur classe A |
| TM-03 | Elevation vers admin | Critique | Faible | Roles serveur, espace protege, RPC restreints | Tests RLS et `route-access.test.ts` |
| TM-04 | Session suspendue encore valide | Eleve | Moyenne | Statut actif dans RLS et proxy fail-closed | Test de suspension professeur |
| TM-05 | Compte admin compromis | Critique | Moyenne | MFA AAL2, moindre privilege, audit | Test AAL1 refuse |
| TM-06 | Brute force/credential stuffing | Eleve | Elevee | Limiteur DB multi-cle, message non enumerant | Tests login et inspection migration |
| TM-07 | XSS/message malveillant | Eleve | Moyenne | Echappement React, CSP, pas de HTML utilisateur | E2E contenu HTML inoffensif |
| TM-08 | Upload malveillant | Eleve | Moyenne | MIME/poids allowlist, nom serveur, bucket prive, URL signee | E2E type interdit |
| TM-09 | Repetition offline | Eleve | Elevee | UUID, recu serveur, lease, idempotence metier | Test DB claim/complete/replay |
| TM-10 | Cache PWA obsolete | Moyen | Elevee | Cache versionne, purge, activation explicite | E2E et procedure d'upgrade |
| TM-11 | Migration partielle | Critique | Moyenne | Transaction, snapshot, verification avant/apres, rollback | Tests PGlite et runbook |
| TM-12 | Fuite dans logs | Eleve | Faible | Logger structure et filtrage des cles sensibles | Revue statique |
| TM-13 | Spam messages/likes | Moyen | Moyenne | Limites DB, unicite, scopes de relation | Tests messagerie/replay |
| TM-14 | Alteration du Coran | Critique | Faible | Source canonique versionnee, checksum, aucune generation IA | Tests canoniques |
| TM-15 | Suppression accidentelle | Critique | Moyenne | Archivage, audit append-only, sauvegarde/rollback | Runbook restauration |

## Hypotheses A Verifier En Staging

- Expiration/revocation Supabase conforme a la configuration du projet reel.
- Sauvegardes et restauration testees avec les droits operateur reels.
- Buckets prives, CORS et URLs de redirection correspondent aux domaines finaux.
- Alertes et retention des logs sont actives sans donnees personnelles inutiles.

Revue requise apres tout changement d'authentification, RLS, stockage, offline, IA ou integration externe.
