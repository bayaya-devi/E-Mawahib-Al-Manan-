# Inventaire fonctionnel vérifiable

Date de référence : 2026-10-31

Branche : `codex/repair-professor-platform-20261031`

Application auditée : `v3/` (Next.js 16, React 19, Supabase)

## Méthode et portée

- 46 fichiers `page.tsx`, 31 route handlers, 51 composants TSX et 226 lignes contenant une interaction ont été détectés.
- Le statut `PASS` n'est utilisé que lorsqu'un test automatisé exécuté dans cette branche couvre l'effet indiqué.
- `BLOCKED` signifie que la preuve exige un Supabase de préproduction et des comptes isolés absents du poste.
- `NOT TESTED` ne signifie pas que la fonctionnalité est défectueuse ; cela signifie qu'aucune preuve d'exécution réelle n'est encore disponible.

## Authentification et socle transversal

| ID | Page | Élément | Comportement attendu | Dépendances | Test prévu | Initial | Défaut/correction | Final | Preuve |
|---|---|---|---|---|---|---|---|---|---|
| AUTH-01 | `/login` | Formulaire identifiant/mot de passe | Authentifier sans révéler l'existence du compte et rediriger selon le rôle | Supabase Auth, rate limit | Identifiants valides/invalides par rôle | NOT TESTED | Aucun compte isolé disponible | BLOCKED | `sign-in.test.ts`, effet distant non testé |
| AUTH-02 | routes privées | Proxy de session | Refuser visiteur, compte inactif et mauvais rôle | `src/proxy.ts`, `user_roles`, `profiles` | Accès direct et session expirée | PASS | Garde serveur centralisée existante | PASS | `route-access.test.ts`, `authorization.test.ts` |
| AUTH-03 | tous espaces | Déconnexion | Invalider la session locale et revenir à `/login` | Supabase Auth | Connexion puis déconnexion répétée | NOT TESTED | — | BLOCKED | Compte de test requis |
| AUTH-04 | paramètres | Comptes de l'appareil | Ajouter, basculer et retirer un compte local sans exposer de secret | localStorage, Supabase session | Test unitaire + E2E | PASS | Coffre local déjà testé | PASS | `device-account-vault.test.ts` |
| X-01 | shell privé | Navigation principale | Chaque lien mène à une route existante et le rail se replie | App Router | Desktop/mobile, retour, rechargement | PASS | Ajout route professeur classes | PASS | tests E2E de navigation en mode isolé |
| X-02 | toutes pages | Centre de notifications | Afficher et marquer les notifications autorisées | RLS, notifications | Réception/lecture réelle | NOT TESTED | — | BLOCKED | Backend de préproduction requis |
| X-03 | paramètres | Confidentialité | Consentement, export et demande de confidentialité | API privacy, audit | Soumission et téléchargement | PASS | — | PASS | `privacy.spec.ts` en environnement isolé |
| X-04 | formulaires supportés | Mode hors ligne | Mettre en file puis resynchroniser sans doublon | IndexedDB, `/api/offline/sync` | Coupure réseau/reprise | PASS | — | PASS | `transverse.spec.ts` |

## Administration

| ID | Page/module | Élément | Comportement attendu | Dépendances | Test prévu | Final | Preuve/limite |
|---|---|---|---|---|---|---|---|
| ADM-01 | `/admin` | Tableau de bord et raccourcis | Afficher les métriques de l'école et ouvrir les modules | repository admin, RLS | Rendu + navigation | PASS | `admin-command.spec.ts` isolé |
| ADM-02 | `/admin/students` | Recherche, filtre, ajout, édition | Gérer uniquement les élèves de l'école | RPC admin, profils | CRUD + rechargement | BLOCKED | Données de préproduction absentes |
| ADM-03 | `/admin/teachers` | Recherche, filtre, ajout, édition | Gérer enseignants et affectations | RPC comptes/classes | CRUD inter-rôles | BLOCKED | Compte direction + données de test requis |
| ADM-04 | `/admin/parents` | Responsables légaux | Consulter et relier les parents autorisés | relations famille | CRUD + contrôle croisé | BLOCKED | Préproduction requise |
| ADM-05 | `/admin/classes` | Classes et affectations | Créer une classe, affecter professeur/élèves, persister | `/api/admin/classes`, RPC | Scénario admin→professeur | BLOCKED | Effet Supabase non exécuté |
| ADM-06 | `/admin/finance` | Paiement/dépense/import | Valider les montants côté serveur, prévisualiser avant import | API finance, tables financières | Données fictives + persistance | BLOCKED | Aucun environnement financier de test |
| ADM-07 | `/admin/communications` | Messages/demandes/notifications | Cibler des destinataires autorisés et auditer l'envoi | messaging RPC, worker | Prévisualisation puis envoi test | PASS | Prévisualisation UI E2E ; livraison externe BLOCKED |
| ADM-08 | `/admin/site` | Contenus et médias publics | Modifier/publier après validation et téléverser un type autorisé | API public-content/media | Upload fictif, publication, relecture | NOT TESTED | Test distant à créer |
| ADM-09 | `/admin/monitoring` | Surveillance/audits | Afficher événements sans permettre leur altération | audit logs | Lecture et filtrage | NOT TESTED | — |
| ADM-10 | `/admin/settings` | Seuils et paramètres | Enregistrer les paramètres de l'école | RPC admin | Modification/rechargement | BLOCKED | Préproduction requise |
| ADM-11 | `/admin/people/[personId]` | Dossier et statut de compte | Consulter/modifier la personne autorisée, activer/désactiver | API people/accounts | IDOR + persistance | BLOCKED | Deux comptes de test requis |
| ADM-12 | operations/resources/workforce/governance/system | Onglets métiers | Afficher données réelles, filtres et états vides | repository admin | Parcours de chaque onglet | NOT TESTED | Pages inventoriées, effets non rejoués |

## Professeur

| ID | Page/module | Élément | Comportement attendu | Dépendances | Test prévu | Initial | Correction | Final | Preuve |
|---|---|---|---|---|---|---|---|---|---|
| TCH-01 | `/teacher` | Accueil | Salutation genrée, classes, horaires, effectifs, prochaine séance | profils/classes | Rendu et données réelles | FAIL | Genre chargé depuis `teacher_profiles`, résumé/raccourcis ajoutés | PASS | Typecheck + rendu isolé ; données distantes BLOCKED |
| TCH-02 | shell | Rail droit/mobile | Plier, rouvrir et conserver l'accès aux 7 modules | React/CSS RTL | Desktop/mobile | PASS | Entrée classes ajoutée | PASS | CSS + E2E navigation |
| TCH-03 | `/teacher/classes` | Cartes de classes | Afficher uniquement les classes affectées, effectifs et horaires | RLS affectations | Rendu/liens | FAIL | Page et composant créés | PASS | `teacher-classes.test.tsx` |
| TCH-04 | `/teacher/students` | Liste/recherche/filtre | Trier en arabe, rechercher, filtrer par classe | repository professeur | Liste volumineuse + recherche | FAIL | Recherche normalisée, filtre, inscriptions paginées par 500 et profils chargés par lots de 200 | PASS | `students-workspace.test.tsx` ; charge distante NOT TESTED |
| TCH-05 | élèves | Fiche, notes, absence, visibilité | Modifier uniquement un élève autorisé et persister | RPC professeur, RLS | Mutation/rechargement/IDOR | NOT TESTED | — | BLOCKED | Supabase de test requis |
| TCH-06 | élèves | Inscription existante | Rechercher dans la même école, affecter à une classe attribuée, éviter doublon | migration `202610310001` | RPC + rechargement | FAIL | RPC transactionnelles et UI ajoutées | PASS | tests UI + tests migrations/RLS |
| TCH-07 | élèves | Nouveau dossier | Créer un dossier sans créer de compte Auth | même migration | Validation/doublon | FAIL | Dossier soumis à validation direction | PASS | tests UI + migrations |
| TCH-08 | `/teacher/session` | Démarrage/reprise | Choisir classe autorisée, démarrer et reprendre une séance | RPC session | Interruption/reprise | FAIL | Assistant 4 étapes et reprise restaurés | PASS | `session-wizard.test.tsx`; effet distant BLOCKED |
| TCH-09 | séance | Présences | Enregistrer présent/absent/retard/excusé | session students | Sauvegarde et rechargement | FAIL | Registre complet rétabli | PASS | test unitaire + migration |
| TCH-10 | séance | Suivi/évaluation/devoir/rapport | Enregistrer récitation, appréciation, note et devoir puis clôturer | RPC session/report | Parcours complet | PASS | Cas zéro présent géré | PASS | tests unitaires ; E2E réel BLOCKED |
| TCH-11 | `/teacher/messages` | Boîte direction | Envoyer, recevoir, répondre, lecture ; direction uniquement | RPC conversations | Deux comptes et persistance | PASS | Restriction serveur existante confirmée | PASS | tests RLS ; échange réel BLOCKED |
| TCH-12 | `/teacher/professional` | Planning/demandes/salaires | Afficher seulement le dossier du professeur et envoyer une demande | RLS + RPC | IDOR et persistance | PASS | — | PASS | tests migrations/RLS ; données réelles non utilisées |
| TCH-13 | professionnel | Documents | Télécharger seulement un document autorisé | bucket privé, RLS | accès propre/croisé/expiré | FAIL | Route authentifiée + URL signée 60 s | PASS | typecheck/RLS ; Storage préprod BLOCKED |
| TCH-14 | `/teacher/settings` | Apparence/comptes/confidentialité | Appliquer et persister les préférences locales | localStorage/APIs privacy | Rendu + persistance | PASS | — | PASS | tests settings + E2E isolé |

## Élève et famille

| ID | Page/module | Élément | Comportement attendu | Dépendances | Test prévu | Final | Preuve/limite |
|---|---|---|---|---|---|---|---|
| STU-01 | `/student` | Accueil | Afficher classe, enseignant, prochaine séance et progression autorisée | repository learning | Rendu/persistance | PASS | `learning.spec.ts`, données réelles BLOCKED |
| STU-02 | `/student/quran` | Catalogue et verrouillage | Ouvrir uniquement l'étape permise | progression/RLS | verrouillage et URL directe | PASS | `learning-plan.test.ts`, E2E learning |
| STU-03 | `/student/quran/[surah]` | Exercices/mémorisation | Charger corpus canonique, sauvegarder avec contrôle de version | API learning | réussite/conflit/réseau | PASS | tests Quran + E2E ; Supabase réel BLOCKED |
| STU-04 | assignments/follow-up/history | Données pédagogiques | Afficher devoirs, retours et historique sans mutation interdite | RLS élève | lecture + IDOR | NOT TESTED | Contrôle distant requis |
| STU-05 | games | Jeux | Proposer uniquement le contenu autorisé et enregistrer le résultat prévu | moteur jeux | scénarios moteur | PASS | `engine.test.ts` |
| STU-06 | profile/settings/parents | Profil, préférences, questionnaire | Limiter les champs modifiables et persister les préférences | APIs/RPC | formulaires + rechargement | NOT TESTED | UI partiellement couverte |
| STU-07 | messages | Messages et demandes | Conversations autorisées et demandes persistantes | messaging/offline | envoi/lecture/offline | PASS | `transverse.spec.ts`; livraison réelle BLOCKED |
| FAM-01 | `/family` | Sélection et suivi enfant | Ne montrer que les enfants liés au parent | family relationships/RLS | deux familles, IDOR | BLOCKED | Comptes isolés requis |
| FAM-02 | family messages/settings | Communication/préférences | Envoyer demande et gérer canaux vérifiés | API contacts/messaging | vérification + persistance | NOT TESTED | Aucun canal de test configuré |

## Site public

| ID | Page/module | Élément | Comportement attendu | Dépendances | Test prévu | Final | Preuve/limite |
|---|---|---|---|---|---|---|---|
| PUB-01 | `/{locale}` | Accueil et navigation | Accéder aux 10 pages en ar/fr/en/amz, RTL arabe | contenu public | menus/liens/mobile | PASS | `public-site.spec.ts` |
| PUB-02 | about/programs/courses/schedule | Contenu | Afficher le contenu publié et états vides | public content | navigation/rendu | PASS | E2E public isolé |
| PUB-03 | registration | Informations d'inscription | Afficher l'état administratif sans inscription fictive | contenu publié | rendu/cohérence | PASS | E2E rendu ; exactitude métier à valider |
| PUB-04 | news/replays/faq | Cartes, accordéons, vues/likes/partage | Interactions stables, compteurs serveur idempotents | API replay | clics/répétition | NOT TESTED | API réelle non exercée |
| PUB-05 | contact | Coordonnées/carte/consentement | Afficher données officielles et charger la carte après consentement | configuration publique | mobile/consentement | PASS | tests public/privacy |
| PUB-06 | legal | Documents juridiques | Afficher des textes validés | contenu légal | revue juridique | FAIL | Marqueur `TODO-JURISTE` présent | FAIL | Validation juridique nécessaire avant production |

## Fichiers et services

| ID | Élément | Attendu | Final | Preuve/limite |
|---|---|---|---|---|
| API-01 | Upload pièces jointes | Type/taille/nom contrôlés, accès membre uniquement | PASS | `upload-validation.test.ts`, RLS ; contenu magique NOT TESTED |
| API-02 | Audio Quran | Code allowlisté et réponse mise en cache | PASS | route test + corpus tests |
| API-03 | Worker notifications | Secret serveur requis et erreurs auditables | NOT TESTED | Aucun fournisseur de test configuré |
| DB-01 | 53 migrations / 111 tables | Migrations rejouables et RLS conservée | PASS | 44 tests PGlite migrations/RLS |
| DB-02 | anciennes tables signalées | Ne pas les supprimer sans preuve ; confirmer leur présence | PASS | Aucun `create table` correspondant dans V3 ; fonctions modernes utilisent relations UUID |
