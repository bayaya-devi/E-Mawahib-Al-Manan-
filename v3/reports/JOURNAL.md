# Journal des interventions

## 2026-10-05 - Module 08 qualité et maintenabilité

État précédent : V3 est fonctionnelle mais ne possédait pas de journal de maintenance ni d'inventaire qualité. Les tests complets pouvaient dépasser la mémoire locale en parallèle. Les grands modules admin sont connus et restent à découper progressivement.

Travail effectué : inventaire produit et qualité, commandes de contrôle documentées, test runner stabilisé sur un fork, rapport de taille générable, conventions de contribution et changelog ajoutés.

État actuel : modules 08 et 03 terminés localement. Le module 03 ajoute le contrôle binaire des téléversements, centralise la protection d'origine, met Next.js à jour en 16.3.8 et élimine les vulnérabilités hautes ou critiques des dépendances de production. Preuves : 128 tests, lint, typecheck, scan des secrets et build réussis. Module 02 prêt à démarrer.

Décisions prises : pas de refactor massif des deux modules admin pendant ce module ; découpage lors des prochaines évolutions avec tests E2E. La compatibilité API est préservée.

À faire par un humain : aucune action technique pour ce module.
## 2026-10-14 - Module 02 backend

- Relations V3 vérifiées: le modèle réel utilise `classes`, `class_enrollments` et `class_teacher_assignments`.
- Capacité des classes rendue atomique sous concurrence.
- Suppression applicative remplacée par une corbeille réversible qui conserve les historiques.
- Dernier compte de direction protégé.
- Métadonnées d'audit nettoyées des secrets usuels.
- Prévisualisation CSV des paiements ajoutée sans écriture automatique.

## 2026-10-14 - Module 04 fiabilité

- Sondes publiques distinctes `/health` et `/ready`, sans fuite de configuration.
- Mode maintenance HTTP 503 laissant les sondes accessibles.
- Erreurs trilingues, logs JSON nettoyés et identifiants de requête.
- Timeouts, reprises exponentielles et circuit breaker pour les dépendances critiques.
- Sauvegardes chiffrées, restauration protégée, test d'intégrité et rétention documentés.
- Supervision Uptime Kuma, configurations PM2/systemd et scénario de charge k6 ajoutés.
