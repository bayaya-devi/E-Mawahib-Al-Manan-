# Matrice des routes et rôles

Source : inventaire de `v3/src/app` au 2026-10-31. Les groupes entre parenthèses ne font pas partie de l'URL.

## Pages applicatives (46 fichiers)

| Espace | Routes | Rôle attendu | Protection | État |
|---|---|---|---|---|
| Public | `/`, `/{locale}`, `/{locale}/{about,programs,schedule,courses,registration,news,replays,faq,contact}` | visiteur | publique | PASS rendu isolé |
| Public légal | `/{locale}/legal/{privacy,terms,cookies,legal}` | visiteur | publique | FAIL validation juridique |
| Auth | `/login` | visiteur | publique | PASS rendu ; connexion réelle BLOCKED |
| Admin principal | `/admin` | admin/direction | proxy + RLS | PASS rendu isolé |
| Admin personnes | `/admin/people`, `/admin/people/[personId]`, `/admin/students`, `/admin/teachers`, `/admin/parents` | admin/direction | proxy + RLS + RPC | BLOCKED effets réels |
| Admin école | `/admin/classes`, `/admin/operations`, `/admin/resources`, `/admin/workforce`, `/admin/governance` | admin/direction | proxy + RLS | BLOCKED effets réels |
| Admin finances | `/admin/finance` | admin/direction | proxy + RLS | BLOCKED données fictives absentes |
| Admin communication | `/admin/communications` | admin/direction | proxy + RLS | PASS rendu ; livraison BLOCKED |
| Admin système | `/admin/monitoring`, `/admin/system`, `/admin/settings`, `/admin/site` | admin/direction | proxy + RLS | NOT TESTED complet |
| Professeur | `/teacher`, `/teacher/classes`, `/teacher/students`, `/teacher/session`, `/teacher/messages`, `/teacher/professional`, `/teacher/reports`, `/teacher/settings` | teacher | proxy + RLS | PASS rendu/tests ciblés ; persistance réelle BLOCKED |
| Élève | `/student`, `/student/quran`, `/student/quran/[surah]`, `/student/assignments`, `/student/follow-up`, `/student/history`, `/student/games`, `/student/messages`, `/student/parents`, `/student/profile`, `/student/settings` | student | proxy + RLS | PASS partiel, IDOR réel BLOCKED |
| Famille | `/family`, `/family/messages`, `/family/settings` | parent | proxy + RLS | PASS rendu, relations réelles BLOCKED |
| Compatibilité | `/messages`, `/requests` | authentifié selon redirection | redirection applicative | NOT TESTED |
| Interne | `/design-system` | actuellement public | aucune | NOT TESTED — décision d'exposition requise |

## Route handlers (31 fichiers)

| Groupe | Routes | Méthodes | Autorisation attendue | État |
|---|---|---|---|---|
| Santé/version | `/health`, `/ready`, `/api/version` | GET | publique, sans données sensibles | PASS statique |
| Auth | `/api/auth/login` | POST | publique + rate limit | PASS tests unitaires, distant BLOCKED |
| Admin comptes | `/api/admin/accounts`, `/api/admin/accounts/[userId]`, `/credentials`, `/status` | POST/PATCH/DELETE | admin/direction | PASS garde proxy + contrôle route à confirmer en E2E |
| Admin données | `/api/admin/classes`, `/people/[userId]`, `/finance`, `/finance/import/preview` | POST/PATCH | admin/direction + validation serveur | BLOCKED persistance réelle |
| Admin publication | `/api/admin/public-content`, `/api/admin/public-media` | GET/POST/PATCH | admin/direction | NOT TESTED réel |
| Admin santé | `/api/admin/health` | GET | admin/direction | NOT TESTED |
| Messages | `/api/messages/attachments`, `/api/messages/attachments/[attachmentId]` | POST/GET | membre de conversation via RLS | PASS tests sécurité statiques/RLS |
| Documents professeur | `/api/teacher/documents/[documentId]` | GET | propriétaire/gestionnaire via RLS | PASS typecheck/RLS, Storage BLOCKED |
| Élève | `/api/student/learning` | GET/POST | étudiant actif + progression autorisée | PASS tests code, distant BLOCKED |
| Public | `/api/public/content`, `/api/public/replays/[replayId]/{view,like}` | GET/POST | public, validation/idempotence | NOT TESTED complet |
| Contacts | `/api/contacts/verification/{request,verify}` | POST | authentifié, OTP/rate limit | NOT TESTED réel |
| Confidentialité | `/api/privacy/{consent,export,requests,retention}` | POST/GET | sujet ou worker autorisé | PASS partiel privacy E2E |
| Offline | `/api/offline/sync` | POST | utilisateur authentifié | PASS UI hors ligne ; replay serveur BLOCKED |
| Notifications | `/api/notifications/worker` | GET/POST | secret worker | NOT TESTED réel |
| Quran | `/api/quran/audio/[code]` | GET | code canonique | PASS test route |

## Règles centrales

- `/admin/**` : `admin` ou `direction`.
- `/teacher/**` : `teacher`.
- `/student/**` : `student`.
- `/family/**` : `parent`.
- Une session absente produit une redirection vers `/ar?auth=required` pour les pages et un JSON 401 pour les API.
- Un rôle interdit ou un profil inactif produit `/ar?auth=forbidden` ou un JSON 403.
- Limite actuelle : `NEXT_PUBLIC_APP_ENV=test` court-circuite volontairement le proxy dans les E2E locaux ; l'autorisation réelle doit être rejouée en préproduction.
