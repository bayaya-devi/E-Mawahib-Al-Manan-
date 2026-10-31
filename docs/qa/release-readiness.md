# Aptitude à la mise en service

## Verdict

**NOT READY FOR PRODUCTION**

Le code a nettement progressé et les tests ciblés critiques réussissent, mais les critères de release exigés ne sont pas tous démontrés.

## Motifs bloquants

1. Aucun environnement de préproduction ni comptes isolés par rôle : les parcours CRUD et inter-rôles ne peuvent pas être prouvés.
2. Les E2E locaux utilisent `NEXT_PUBLIC_APP_ENV=test`, qui contourne volontairement le contrôle de session du proxy.
3. Le build production et la suite complète n'ont pas abouti sur ce poste faute de mémoire/espace.
4. Les textes juridiques portent encore le marqueur `TODO-JURISTE`.
5. Aucune mesure Lighthouse/Web Vitals/SQL représentative n'a été obtenue.
6. Les migrations `202610310001` et `202610310002` sont validées localement mais non appliquées en préproduction/production.

## Contrôles réussis

- TypeScript et lint ciblé.
- 44 tests de migrations et politiques RLS.
- Tests ciblés des inscriptions, classes, liste d'élèves et séances professeur.
- Protection de routes centralisée et contrôles RLS présents.
- Documents professeur privés avec URL signée courte.
- Aucun secret réel ajouté au dépôt.
- Audit des dépendances de production sans vulnérabilité haute ou critique après mise à jour de Next.js et Zod.

## Sécurité

Revue à haute confiance : aucune injection, XSS explicite, exécution de commande ou lecture de chemin utilisateur confirmée dans `v3/src`. Les contrôles d'objet reposent sur RLS/RPC et doivent encore être validés avec deux utilisateurs réels de chaque rôle pertinent. L'absence de test d'autorisation dynamique empêche une déclaration de sécurité complète.

## Déploiement

| Élément | État |
|---|---|
| Modifications locales | oui |
| Commits | `9788b26`, `8a5c5e7`, `3399455` ; documentation du présent lot à committer |
| Push distant | non |
| Préproduction | non |
| Production | non |
| Migrations appliquées | non |
| Migrations en attente | `202610310001_v3_teacher_student_enrollment.sql`, `202610310002_v3_teacher_private_documents.sql` |

## Passage possible à READY FOR CONTROLLED RELEASE

- Provisionner une préproduction anonymisée et des comptes admin/direction/professeur/élève/parent.
- Appliquer les migrations après sauvegarde et vérifier leur rollback opérationnel.
- Exécuter lint, typecheck, suite complète, build puis Playwright contre le build.
- Rejouer les scénarios inter-rôles et vérifier les données après rechargement.
- Valider juridiquement les pages légales.
- Mesurer les parcours principaux sur mobile et bureau.
- N'effectuer le déploiement contrôlé qu'après résolution ou acceptation explicite de chaque FAIL/BLOCKED.
