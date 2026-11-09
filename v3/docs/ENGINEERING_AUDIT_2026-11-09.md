# E-Mawahib Al-Manan - audit d'ingenierie initial

Date: 2026-11-09

## Etat actuel

- Application unique Next.js 16 / React 19 / TypeScript, App Router.
- Supabase assure Auth, PostgreSQL, RLS, Storage et Realtime.
- Quatre surfaces partagent le meme projet: public, eleve, professeur et administration.
- 251 fichiers source, 31 routes API, 53 migrations et 25 fichiers de tests applicatifs.
- Les contrats metier sensibles sont principalement portes par des fonctions PostgreSQL `security definer` avec controle AAL2 et RLS.
- Le frontend dispose deja d'un design system adaptatif, d'un mode clair/sombre et de variantes RTL/LTR.

## Risques constates

### Critique

- Aucun secret client detecte, mais toute nouvelle mutation administrative doit continuer a passer par une API gardee ou une RPC autorisee; ne pas introduire de `service_role` dans le navigateur.
- La comptabilite manuelle historique ne possedait pas encore d'idempotence, d'annulation tracee ni d'affectation analytique robuste.

### Eleve

- `getAdminCommandData` execute le meme agrégat d'environ 30 requetes pour presque toutes les pages admin.
- Les pages Parametres, Parents et Suivi chargent donc des donnees sans rapport avec leur besoin, dont jusqu'a 5 000 presences et 5 000 ecritures financieres.
- `administration-workspaces.tsx` (plus de 1 100 lignes), `repository.ts` (pres de 900 lignes) et le type DB genere (plus de 2 000 lignes) concentrent trop de responsabilites.
- L'emulateur PGlite en memoire atteint sa limite sur la suite complete des 53 migrations; la suite doit etre fractionnee sans reduire sa couverture.

### Modere

- Plusieurs composants clients appellent directement des RPC Supabase. C'est acceptable lorsque les RPC imposent RLS et autorisation serveur, mais les erreurs et formats de reponse ne sont pas encore uniformes.
- Le CMS admin utilise encore des `select('*')`, ce qui augmente le transfert et couple l'interface au schema.
- L'internationalisation est complete sur le site public et avancee chez l'eleve, mais reste partielle dans l'administration et chez le professeur.

## Points solides a preserver

- CSP, HSTS, COOP, anti-framing et politique de permissions sont configures.
- Les images Next sont servies en AVIF/WebP.
- Les roles, statuts, relations classe/eleve/professeur et donnees pedagogiques ont des sources centrales.
- Les paiements eleves et salaires professeurs alimentent deja un registre financier commun.
- Les tests RLS verifient l'isolation entre ecoles et utilisateurs.
- Le corpus coranique possede un controle d'integrite dedie.

## Plan priorise

1. Finaliser le noyau financier idempotent, les annulations et les charges recurrentes.
2. Remplacer l'agregat admin universel par des lectures par domaine, avec pagination.
3. Fractionner les composants admin volumineux sans dupliquer la logique metier.
4. Uniformiser les erreurs API et ajouter un identifiant de correlation.
5. Eliminer les `select('*')` du CMS et mesurer les volumes transferes.
6. Fractionner les tests SQL pour une execution stable en CI.
7. Mesurer build, budgets statiques et parcours Playwright mobile/desktop.
8. Completer l'internationalisation admin/professeur et les controles WCAG 2.2 AA.

## Regle de livraison

Chaque lot doit passer lint, typecheck, tests cibles et build avant commit. La production ne sera pas modifiee sans autorisation explicite.
