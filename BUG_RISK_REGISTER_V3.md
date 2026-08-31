# Bug Risk Register V3

| ID | Module | Risque | Severite | Prob. | Prevention/detection | Recuperation | Statut |
|---|---|---|---:|---:|---|---|---|
| BR-001 | Auth | Session suspendue reutilisee | Elevee | Moyenne | Statut actif proxy/RLS, test negatif | Revoquer sessions, auditer | Mitige |
| BR-002 | Offline | Mutation rejouee deux fois | Elevee | Elevee | Recu UUID, lease, contraintes | Rejouer seulement `failed` | Mitige |
| BR-003 | PWA | Ancienne interface avec nouveau schema | Elevee | Moyenne | Version cache, activation controlee | Purge caches et rollback | Mitige |
| BR-004 | Admin | Ecrasement concurrent d'un dossier | Elevee | Moyenne | `updated_at`; verrou optimiste a generaliser | Restaurer audit/sauvegarde | Ouvert avant CRUD final |
| BR-005 | Migration | Comptages V1/V3 divergents | Critique | Moyenne | Snapshot et verification | Stop, rollback, quarantaine | Controle staging requis |
| BR-006 | Storage | Fichier actif malgre DB refusee | Moyen | Faible | Suppression compensatoire | Job de recherche orphelins | Mitige |
| BR-007 | Notifications | Realtime indisponible | Faible | Moyenne | Donnee metier enregistree avant notification | Recharge in-app | Accepte |
| BR-008 | Observabilite | Erreur silencieuse repository | Moyen | Moyenne | Logger structure a generaliser | Diagnostic admin | En cours |
| BR-009 | Audio/ASR | Support navigateur absent | Moyen | Elevee | Feature flag et parcours non bloquant | Methode manuelle | Mitige |
| BR-010 | Sauvegarde | Restauration jamais exercee | Critique | Faible | Exercice trimestriel | Procedure DR | Controle operateur requis |
| BR-011 | CSP | `unsafe-inline` necessaire au rendu Next | Moyen | Faible | Sources strictes, aucun `unsafe-eval` | Passer a nonce apres validation | Dette documentee |
| BR-012 | Charge | Historique admin volumineux | Moyen | Moyenne | Limites/index; pagination a generaliser | Mode degrade | Test charge staging requis |

Un risque critique ouvert interdit la production. Chaque bug serieux ajoute un test de regression et met a jour ce registre.
