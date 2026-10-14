# Audit backend V3 - 14 octobre 2026

## Etat initial

- Architecture: Next.js App Router, TypeScript, Supabase Auth/PostgreSQL/RLS, routes serveur pour les mutations privilégiées.
- Modèle réel: `classes`, `class_enrollments`, `class_teacher_assignments`, `student_profiles`, `teacher_profiles`, `conversations`, `conversation_messages`, `audit_logs`.
- Les noms `school_classes`, `class_students`, `teacher_classes`, `student_admin_profiles`, `teacher_admin_profiles`, `school_messages` et `admin_audit_logs` appartiennent à un diagnostic ancien et ne sont pas le modèle V3 de référence.
- Les relations classe/élève/professeur possédaient déjà des clés étrangères UUID, des index partiels et un historique d'affectation.
- `audit_logs` était déjà protégé en écriture pour les clients et par un déclencheur append-only.
- `class_enrollments.enrolled_at` permet déjà une inscription individuelle en cours d'année.

## Problèmes confirmés et corrigés

1. La capacité d'une classe n'était pas contrôlée atomiquement lors d'une affectation.
2. La suppression définitive applicative effaçait des historiques pédagogiques et opérationnels.
3. Aucun garde-fou de base ne protégeait explicitement le dernier compte de direction actif.
4. Les métadonnées d'audit n'étaient pas nettoyées récursivement des clés manifestement sensibles.
5. Le module financier ne disposait pas d'un pré-validateur CSV réutilisable.

## Corrections

- Verrouillage de la ligne classe et contrôle de capacité dans les deux mutations d'affectation.
- Déduplication des identifiants reçus avant enregistrement.
- Corbeille réversible des comptes: accès archivé, affectations actives closes, historique conservé.
- Restauration de l'identité sans réouvrir silencieusement d'anciennes affectations.
- Protection du dernier compte de direction actif.
- Nettoyage récursif des champs `password`, `secret`, `token`, `authorization` et `cookie` avant insertion dans l'audit.
- Prévisualisation CSV sans écriture, avec validation, détection de doublons et limite de taille.

## Tables examinées

| Table | Rôle | Risque principal | Etat |
| --- | --- | --- | --- |
| `profiles` | identité et statut | suppression/dernier admin | renforcé |
| `user_roles` | rôles serveur | auto-promotion | RLS et écritures privilégiées existantes |
| `school_memberships` | rattachement établissement | portée inter-écoles | contrôlée |
| `classes` | source de vérité des classes | dépassement capacité | renforcé |
| `class_enrollments` | historique élève-classe | doublon actif | index partiel existant |
| `class_teacher_assignments` | historique professeur-classe | plusieurs principaux | index unique existant |
| `audit_logs` | traçabilité | falsification/secrets | renforcé |
| `student_payments` | paiements mensuels | doublons/périodes | unicité existante, CSV préparé |
| `finance_transactions` | grand livre partagé | incohérence de source | mutations transactionnelles existantes |

## Performances

- Aucun chiffre de production n'a été inventé: les métriques SQL de production ne sont pas accessibles depuis la suite locale.
- Les index utiles aux relations actives existaient déjà.
- Le contrôle de capacité réutilise l'index `(class_id, status)` et verrouille une seule classe.
- Aucun index spéculatif supplémentaire n'a été ajouté.

## Sauvegarde et retour arrière

- Les migrations sont additives et ne suppriment aucune donnée.
- `202610140001` remplace deux fonctions; un rollback consiste à restaurer leur version de `202609130007` et `202609280001`.
- `202610140002` peut être neutralisée en retirant les deux déclencheurs et les deux RPC. Les colonnes `deleted_at` et `deleted_by` doivent être conservées tant qu'une ligne supprimée logiquement existe.
- Avant toute suppression physique future, une sauvegarde PostgreSQL vérifiée et une politique de conservation sont obligatoires.

## Limites

- Aucun fournisseur de facturation n'étant défini, aucune synchronisation externe n'a été simulée.
- Le CSV est uniquement prévisualisé; une confirmation d'import transactionnelle sera ajoutée lorsque le format métier définitif sera validé.
- Les mesures de requêtes lentes en production nécessitent les métriques Supabase/pg_stat_statements du projet.
