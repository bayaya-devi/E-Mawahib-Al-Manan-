# Edge Cases V3

| Domaine | Cas limite | Comportement attendu | Preuve |
|---|---|---|---|
| Auth | Mot de passe faux, compte absent | Meme message, limite appliquee | Route login + rate limit |
| Auth | Suspendu avec ancien cookie | Espace refuse; RLS active refuse les donnees | Proxy + test DB |
| Auth | Admin AAL1 | Redirection MFA/API 403 | Test DB AAL1 |
| Navigation | URL admin saisie par eleve | Refus serveur, aucun shell admin | `route-access.test.ts` |
| Famille | Parent sans enfant | Etat vide, aucune donnee tierce | RLS + UI vide |
| Classe | Classe vide/sans professeur | Diagnostic non bloquant | `system_diagnostics()` |
| Classe | Eleve deplace | Une affectation active; historique conserve | Contraintes + migration staging |
| Seance | Double demarrage | Une execution active ou erreur metier | RPC professeur |
| Seance | Fermeture navigateur | Brouillon/reprise; pas de rapport invente | E2E mode seance |
| Rapport | Double soumission | Etat final stable, pas de doublon | RPC et test DB |
| Messagerie | HTML/script | Texte echappe, jamais interprete | React + CSP + E2E |
| Messagerie | Destinataire archive | Relation refusee | RPC `can_message_user` |
| Upload | MIME interdit/trop gros | 400 sans stockage persistant | Route attachment |
| Offline | Coupure avant reponse | Recu/lease puis retry unique | `offline_mutation_receipts` |
| Offline | Conflit metier | Etat `conflict`, saisie conservee | Provider IndexedDB |
| Offline | IndexedDB indisponible | Message humain, app en ligne utilisable | Error boundary/tests navigateur |
| PWA | Ancien service worker | Proposition de mise a jour controlee | `sw.js` + provider |
| Reseau | Supabase lent | Timeout diagnostic; module degrade | Health check |
| Coran | Verset inexistant | Validation 1..verse_count | RPC pratique |
| IA | Confiance insuffisante | `unverified/needs_review`, aucune note certaine | Moteur recitation |
| Donnee | Valeur null inattendue | Etat vide ou erreur structuree | Repositories/types |
| Concurrence | Deux admins meme dossier | Risque ouvert BR-004, verrou optimiste requis avant prod | Registre risques |
