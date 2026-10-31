# Audit de sécurité - module 03

Date : 2026-10-05

## Constats avant correction

| Gravité | Surface | Constat | Décision |
| --- | --- | --- | --- |
| Moyenne | Téléversements | Les fichiers joints et les médias publics étaient acceptés selon le type MIME déclaré par le navigateur. | Corrigé : contrôle des signatures binaires, liste blanche et taille maximale avant lecture du corps. |
| Faible | Protection CSRF | La route d'apprentissage utilisait son propre contrôle d'origine au lieu du garde partagé. | Corrigé : garde `hasTrustedOrigin` commune. |
| Critique | Dépendances de production | Next.js 16.3.3 exposait une vulnérabilité RCE publiée après l'audit initial. | Corrigé par mise à jour vers Next.js 16.3.8. |
| Haute | Traitement des images | La dépendance transitive `sharp` était vulnérable. | Corrigé vers `sharp` 0.35.5. |
| Acceptée, développement uniquement | Outillage ESLint | L'arbre de `eslint-config-next` contient une alerte `braces` sans correctif compatible ; le correctif forcé rétrograderait Next.js. | Aucun code concerné n'est livré en production. Surveillance maintenue jusqu'à une mise à jour compatible. |

## Contrôles confirmés

- Pas de `dangerouslySetInnerHTML`, `innerHTML` non maîtrisé, `eval` ou SQL construit par concaténation dans `src`.
- Les mutations d'administration passent par un garde central : origine vérifiée, session, rôle et statut.
- Les permissions métier reposent sur Supabase RLS et les tests de migrations vérifient l'isolation entre utilisateurs.
- Les secrets serveur restent dans l'environnement ; le scan local de secrets est exécuté dans la suite de livraison.
- Les en-têtes CSP, HSTS, anti-framing, `nosniff`, referrer et permissions sont configurés dans `next.config.ts`.
- `npm audit --omit=dev --audit-level=high` retourne zéro vulnérabilité de production.
- La suite de sécurité et la suite complète valident respectivement les frontières critiques et 128 tests.

## Limites de l'audit

La configuration de fournisseurs externes (Cloudflare, Supabase, Vercel, DNS et antivirus) ne peut être validée localement. Aucun secret ou identifiant réel n'est inscrit dans ce rapport.
