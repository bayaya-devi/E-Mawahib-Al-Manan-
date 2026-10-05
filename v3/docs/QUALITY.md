# Qualité et maintenabilité

## Commandes de contrôle

```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:critical
npm run test:coverage
npm run build
npm run check
npm run quality:report
```

`npm run check` est le contrôle de livraison local. Il ne modifie pas la base de données de production et ne déploie rien.

## Conventions conservées

- `src/app` contient les routes Next.js ; `src/features` contient la logique métier et les écrans ; `src/lib` contient les frontières techniques ; `src/components` contient les composants réutilisables.
- Toute entrée API est validée côté serveur. Les mutations administratives passent par les routes protégées et l'autorisation centrale.
- Les fichiers de plus de 500 lignes sont recensés par `npm run quality:report`. Ils sont découpés par responsabilité lors d'une évolution métier, avec des tests de non-régression, jamais par réécriture massive.
- La suite Vitest s'exécute dans un seul processus pour rester fiable sur les machines de faible capacité mémoire.

## Limites actuelles

`src/features/admin/administration-workspaces.tsx` et `src/features/admin/repository.ts` restent les deux modules les plus denses. Leur découpage est prévu progressivement : la première regroupe plusieurs vues d'administration, la seconde agrège les données du tableau de commandement. Les extraire sans parcours E2E complet créerait plus de risque que de valeur pendant ce module.
