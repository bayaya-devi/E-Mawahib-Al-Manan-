# Cloisonnement V3

La plateforme reste un seul déploiement Next.js afin de ne pas casser les
comptes, les URLs, l'application Android ou les données existantes. Elle est
cependant organisée en trois frontières strictes.

## Frontend

- `src/components` et les composants `"use client"` ne contiennent que
  l'affichage, les interactions et les appels vers les API/RPC autorisés.
- Ils n'importent jamais `createAdminClient`, une clé secrète, ni une variable
  serveur. ESLint bloque désormais ces imports.

## Backend applicatif

- `src/app/api` contient les commandes HTTP, les contrôles d'origine, la
  validation Zod et les réponses publiques.
- `src/features/*/application` contient les cas métier serveur.
- `src/lib/auth` est la source unique pour la session, le statut de compte et
  les rôles. Les mutations d'administration passent par
  `requireAdministrationMutation`.

## Données et sécurité

- Supabase Auth gère les sessions.
- Les politiques RLS limitent les lectures et écritures directes des clients.
- Le client service role vit uniquement dans `src/lib/supabase/admin.ts`, marqué
  `server-only`, et n'est utilisé que pour les actions qui l'exigent.
- Les migrations SQL restent la source de vérité pour les schémas, contraintes
  et politiques RLS.

## Règle de développement

Une nouvelle fonctionnalité suit toujours :

`interface -> API validée -> service métier -> RLS / base de données`

Une API de mutation vérifie à la fois l'origine de la requête, la session,
l'état actif du compte et son rôle. Aucune permission ne dépend du localStorage.
