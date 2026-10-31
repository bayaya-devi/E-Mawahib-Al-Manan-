# Résultats de tests

Date : 2026-10-31. Les résultats ci-dessous correspondent uniquement aux commandes réellement exécutées.

| Domaine | Commande/suite | Résultat | Détail |
|---|---|---|---|
| Types | `npm run typecheck` | PASS | TypeScript sans erreur après corrections |
| Lint ciblé | `npx eslint ...` sur fichiers modifiés | PASS | aucune erreur ni avertissement |
| Professeur UI | Vitest `students-workspace`, `teacher-classes`, `session-wizard` | PASS | recherche/filtre, inscription, classes, présence/séance |
| Sécurité/autorisation ciblées | 7 fichiers Vitest mono-worker | PASS | 14 tests initiaux réussis ; séance rejouée séparément 2/2 après ajustement du délai |
| Migrations/RLS | Vitest PGlite mono-worker | PASS | 44/44 tests |
| Régression globale | Vitest complet | BLOCKED | V8 `Fatal process out of memory: Zone` avant résultat complet |
| Build production | `npm run build` | BLOCKED | non relancé : espace libre et mémoire insuffisants ; `.next` absent |
| Playwright | suites E2E | BLOCKED | démarrage Next/Chromium précédemment impossible dans la limite mémoire/disque ; nouvelle assertion professeur non encore exécutée |
| Auth réelle | comptes admin/teacher/student/parent | BLOCKED | aucun `.env` réel, aucun storage state, aucun compte isolé |
| Secrets | `npm run security:secrets` | PASS | 386 fichiers analysés, aucun secret détecté |
| Découverte E2E | `npx playwright test --list` | PASS | 129 scénarios valides sur Chrome/tablette/mobile |
| Dépendances | `npm audit` | NOT TESTED dans ce lot | réseau/lockfile à contrôler avant release |
| Performance | Lighthouse/Web Vitals/SQL EXPLAIN | NOT TESTED | serveur déployé et données représentatives requis |

## Couverture démontrée

- Public : rendu/navigation responsive et en-têtes de sécurité couverts par les E2E existants, mais non rejoués dans ce lot faute de ressources.
- Administration : rendu des écrans couvert en environnement isolé ; aucun CRUD Supabase réel n'est déclaré PASS.
- Professeur : logique critique couverte par tests UI et DB ; persistance inter-rôles réelle reste BLOCKED.
- Élève : plan Quran, corpus, moteur de jeu, route audio et stabilisation couverts par tests ; autorisation horizontale réelle reste BLOCKED.
- Famille : rendu isolé existant ; relations parent-enfant réelles restent BLOCKED.

## Commande de reprise recommandée

Sur une machine disposant d'au moins 4 Go de mémoire libre et d'un Supabase de préproduction :

```powershell
npm ci
npm run security:secrets
npm run lint
npm run typecheck
npm run test:run -- --pool=threads --maxWorkers=1
npm run build
$env:PLAYWRIGHT_USE_BUILD='1'
npm run test:e2e
```

Les états d'authentification doivent être créés hors dépôt pour chaque rôle ; aucun mot de passe ne doit être commité.
