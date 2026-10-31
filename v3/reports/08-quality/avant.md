# Module 08 - état initial

Date : 2026-10-05

- 207 fichiers TypeScript/TSX, environ 11 404 lignes source.
- 25 fichiers de tests, environ 2 147 lignes de tests.
- TypeScript est déjà en mode strict avec `exactOptionalPropertyTypes` et `noUncheckedIndexedAccess`.
- Les scripts locaux existent : lint, typecheck, Vitest, Playwright, build et contrôle des secrets.
- Les fichiers les plus denses sont `src/features/admin/administration-workspaces.tsx` (1 055 lignes) et `src/features/admin/repository.ts` (813 lignes).
- La suite complète Vitest peut dépasser la mémoire d'un poste modeste lorsqu'elle utilise plusieurs workers. Ce module la bascule vers un seul fork.
- Les routes ne sont pas encore versionnées. Ce changement est différé pour éviter toute rupture d'API pendant le module qualité ; il sera traité avec le module backend.
