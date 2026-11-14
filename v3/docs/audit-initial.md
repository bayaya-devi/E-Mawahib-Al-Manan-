# Audit initial - e-Mawahib Al-Manan

Date : 14 novembre 2026

## Perimetre et environnement

- Depot : `bayaya-devi/E-Mawahib-Al-Manan-`
- Branche de travail : `codex/staging-crud-validation`
- Production observee : commit `a202c6a2097c5c1d32f5aad886535c804f5ed30a`
- Correctif de validation de comptes present sur la branche : `253966b`
- Supabase officiel : `DARALQURAN` (`mdgofogpghlwesaduxrq`)
- Le projet Supabase `Mawahib` n'est pas utilise dans ce workflow.
- Docker n'est pas installe sur la machine. Supabase local complet est donc bloque. Les tests de base locaux disponibles reposent sur PGlite et des donnees fictives.
- Les variables Vercel Preview observees ne pointent pas vers la production. Aucun test destructif n'est autorise sur la base officielle.

## Etat verifie

### Production

- `/api/version` expose le commit `a202c6a`.
- La connexion administrateur repond correctement et cree une session.
- La page `/admin` authentifiee affiche la nouvelle administration arabe, avec les donnees reelles du Dar.
- Une capture de verification existe dans `.artifacts/admin-production-authenticated.png`.
- Sans session, `/admin` redirige vers la partie publique avec `auth=required`. Ce comportement peut donner l'impression que l'ancienne administration est absente.
- Les comptes professeur et eleve ne sont pas encore verifies en navigateur faute d'identifiants de test isoles valides.

### Anomalie bloquante reproduite

- L'API de connexion renvoyait `200` et le role `direction`, mais l'interface restait sur `/login`.
- Cause : navigation client immediatement apres pose des cookies Supabase ; le middleware et les composants serveur ne relisaient pas toujours la nouvelle session.
- Correctif local : navigation document complete avec `window.location.assign`, accompagnee d'un test de selection de destination par role.
- Etat : code local non encore commite au debut de cet audit.

### Comptes administratifs

- La creation d'un eleve ou professeur utilise un flux unique : compte Auth, profil, dossier, affectation, puis verification.
- Le formulaire bloque volontairement les mots de passe inferieurs a 8 caracteres.
- La meme limite existe dans le schema serveur de creation et dans la route de reinitialisation.
- La connexion des comptes historiques conserve une validation minimale de 1 caractere et n'impose pas retroactivement la regle de creation.
- La documentation Supabase recommande au moins 8 caracteres pour les nouveaux mots de passe.

## Ecarts avec la mission actuelle

### Espace eleve

Les routes et liens suivants existent encore :

- `/student/messages`
- `/student/games`
- `/student/parents`
- `/student/settings`

La navigation propose encore le francais. La mission actuelle demande une interface eleve arabe uniquement et une navigation limitee a l'accueil, au Coran, au suivi et au dossier.

### Espace professeur

Les routes et liens suivants existent encore :

- `/teacher/session`
- `/teacher/messages`
- `/teacher/settings`

La mission actuelle demande de ne plus exposer ces entrees et de concentrer le parcours sur l'accueil, les eleves et le dossier professionnel.

### Site public

La navigation expose encore dix rubriques : accueil, presentation, programmes, horaires, cours, inscriptions, actualites, conferences, FAQ et contact.

La mission actuelle demande un perimetre public reduit :

- Accueil
- Programme
- Horaires et contact
- Conferences

Le contenu Programme contient encore la Sunna, alors que le nouveau perimetre demande uniquement Coran, tajwid et aqida.

### Administration

Les ecrans administratifs recents sont presents. Les CRUD eleves/professeurs, la suppression definitive controlee, l'archivage, les affectations et la finance doivent encore etre testes de bout en bout dans un environnement isole avant toute affirmation de fonctionnement complet.

## Risques prioritaires

1. Ne pas retirer une route avant d'avoir verifie qu'aucun parcours autorise ne depend encore de son composant ou de ses donnees.
2. Ne pas tester la creation, suppression ou finance avec les donnees de production.
3. Ne pas promouvoir une Preview configuree avec une base factice comme si elle validait le backend reel.
4. Ne pas fusionner le correctif `253966b` sans aligner les messages UI et les tests de validation.
5. Ne pas annoncer les espaces professeur et eleve comme verifies tant qu'une connexion reelle par role n'a pas ete executee.

## Plan de correction controle

1. Valider et commiter le correctif de redirection apres connexion.
2. Aligner les validations et messages de mot de passe sur la regle serveur.
3. Simplifier les navigations eleve et professeur, puis rediriger proprement les anciennes routes sans supprimer de donnees.
4. Reduire le site public et conserver des redirections stables pour les anciennes URL utiles au referencement.
5. Executer lint, typecheck, tests cibles, build et controles de routes apres chaque lot.
6. Tester visuellement les roles disponibles avec Edge/Playwright.
7. Ne deployer en production qu'apres validation des tests critiques et verification d'un deploiement Vercel `Ready`.
