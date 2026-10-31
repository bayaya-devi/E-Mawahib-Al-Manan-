# Registre des anomalies

| ID | Sévérité | Symptôme/cause racine | Correction | Régression | État |
|---|---|---|---|---|---|
| BUG-001 | Haute | Présence absente du parcours de séance ; état incomplet entre UI et tables de session | Registre quatre états, reprise et filtrage des élèves présents/retardataires | `session-wizard.test.tsx` | CORRIGÉ |
| BUG-002 | Haute | Inscription professeur sans workflow atomique ni prévention fiable des doublons | RPC transactionnelles, contrôle classe/capacité/école, dossier séparé du compte Auth | tests UI + 44 tests DB | CORRIGÉ |
| BUG-003 | Moyenne | Aucune page professeur pour les classes malgré le besoin et la navigation métier | `/teacher/classes`, cartes horaires/effectifs et liens contextuels | `teacher-classes.test.tsx` | CORRIGÉ |
| BUG-004 | Moyenne | Liste professeur sans recherche arabe ni filtre de classe | Normalisation des diacritiques/alif/ya, filtre et état vide | `students-workspace.test.tsx` | CORRIGÉ |
| BUG-005 | Haute | Documents professionnels pointaient directement vers `storage_path` | Route authentifiée, contrôle RLS, expiration et URL signée 60 s, bucket privé | typecheck + tests DB | CORRIGÉ |
| BUG-006 | Basse | Salutation professeur neutre malgré un genre déjà stocké | Lecture `teacher_profiles.gender` dans accueil et shell | typecheck | CORRIGÉ |
| BUG-007 | Moyenne | Test E2E professeur attendait l'ancien titre et ignorait la nouvelle route classes | Assertion sur la salutation et couverture `/teacher/classes` | 129 tests Playwright découverts sans erreur ; exécution navigateur à relancer | CORRIGÉ, NAVIGATEUR BLOQUÉ mémoire |
| BUG-011 | Haute | La liste d'inscriptions professeur reposait sur la limite de lignes Supabase par défaut et pouvait tronquer un grand effectif | Pagination stable par 500 inscriptions et chargement des profils par lots de 200 | Typecheck ; charge Supabase à rejouer | CORRIGÉ, CHARGE RÉELLE BLOCKED |
| BUG-012 | Critique | Le quality gate a détecté des avis de sécurité de production affectant Next.js 16.3.8 et Zod 4.5.4 | Next.js 16.4.3 et Zod 4.6.6, lockfile régénéré | `npm audit --omit=dev --audit-level=high` | CORRIGÉ |
| BUG-008 | Bloquante release | Pages juridiques contiennent `TODO-JURISTE` | Aucune règle juridique inventée ; validation humaine requise | inspection code | OUVERT |
| BUG-009 | Bloquante QA | Aucun environnement Supabase de préproduction ni comptes de test multi-rôles disponibles | Préparer comptes isolés hors dépôt et secrets CI | E2E inter-rôles requis | OUVERT |
| BUG-010 | Infrastructure | Suite complète/build/Playwright tués par manque de mémoire/disque local | Suites ciblées mono-worker ; aucune falsification de résultat | rapports de commande | OUVERT |

## Éléments examinés sans vulnérabilité confirmée

- Les anciennes tables signalées (`school_classes`, `class_students`, `teacher_classes`, `student_admin_profiles`, `teacher_admin_profiles`, `school_messages`, `admin_audit_logs`) ne sont pas créées dans le schéma V3 actuel. Le nom `admin_set_teacher_classes` est une fonction métier, pas une table textuelle incohérente.
- Aucun usage applicatif de `dangerouslySetInnerHTML`, `eval`, `new Function` ou commande shell alimentée par une requête n'a été détecté dans `v3/src`.
- Les téléchargements de pièces jointes et documents utilisent un identifiant indirect, RLS puis une URL signée courte ; aucun chemin fourni par le navigateur n'est lu directement sur le système de fichiers.
