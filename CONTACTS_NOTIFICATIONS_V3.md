# Contacts et notifications V3

## Modèle de contact

- `contact_points` conserve une identité normalisée unique (email en minuscules ou téléphone E.164).
- `user_contact_links` crée la relation plusieurs-à-plusieurs. Un téléphone parental peut donc être lié au parent et à plusieurs enfants sans duplication.
- Les statuts de vérification sont `unverified`, `pending`, `verified` et `disabled`.
- Les lectures ordinaires passent par `list_my_contacts()` et retournent une valeur masquée. Les coordonnées brutes ne sont pas lisibles par l'élève, le parent ou le professeur.
- Une modification administrative exige un périmètre scolaire valide et l'assurance MFA AAL2.

## Chaîne de notification

1. Un événement métier est écrit dans `notification_events` avec une clé de déduplication.
2. `route_notification_event()` détermine les destinataires directs, explicites et responsables légaux.
3. Une notification interne est écrite dans `user_notifications` même si aucun contact externe n'existe.
4. Les canaux externes sont placés dans `notification_deliveries` uniquement pour des contacts actifs, vérifiés et autorisés.
5. Le worker réclame un lot avec verrouillage, appelle l'adaptateur serveur puis journalise le résultat.
6. Un échec est retenté avec délai exponentiel. Après le maximum de tentatives, il passe en `dead_letter` et devient visible à l'administration.

Le déclencheur de présence capture toute erreur du moteur. Une panne de notification ne peut donc pas annuler l'enregistrement d'une absence ou d'un retard.

## Fournisseurs

Les fournisseurs email, SMS et push sont des webhooks serveur configurés par variables d'environnement. Aucun secret n'est envoyé au navigateur. WhatsApp reste volontairement désactivé jusqu'à l'intégration d'une API Business officielle.

Variables :

- `NOTIFICATION_WORKER_SECRET`
- `NOTIFICATION_EMAIL_WEBHOOK_URL` / `NOTIFICATION_EMAIL_WEBHOOK_TOKEN`
- `NOTIFICATION_SMS_WEBHOOK_URL` / `NOTIFICATION_SMS_WEBHOOK_TOKEN`
- `NOTIFICATION_PUSH_WEBHOOK_URL` / `NOTIFICATION_PUSH_WEBHOOK_TOKEN`

Le planificateur appelle `POST /api/notifications/worker` avec `Authorization: Bearer <NOTIFICATION_WORKER_SECRET>`. Sans fournisseur configuré, les livraisons restent traçables et finissent en file d'intervention ; elles ne sont jamais comptées comme réussies.

## Contrôles administratifs

- `admin.send.broadcast` autorise un envoi normal.
- `admin.send.urgent_broadcast` est réservé à la direction.
- L'interface calcule le nombre réel de destinataires avant confirmation.
- Chaque campagne et chaque livraison conservent son historique.
- Les événements importants peuvent imposer des canaux via `notification_policies`.

## Tests couverts

- contact commun parent/enfant sans duplication ;
- refus d'un téléphone non E.164 ;
- masquage et RLS inter-comptes ;
- routage d'une absence vers élève et responsable ;
- préférence SMS ;
- déduplication ;
- retry et dead-letter ;
- absence d'écriture directe depuis le navigateur.
