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

## Fournisseurs opérationnels

- Email : API Resend avec clé d'idempotence par livraison.
- SMS : API Twilio Messages avec destination E.164 et numéro expéditeur ou Messaging Service.
- Push : Web Push standard signé par VAPID, sans fournisseur applicatif payant.
- Les anciens webhooks restent un fallback compatible. Aucun secret n'est envoyé au navigateur.
- WhatsApp reste volontairement désactivé jusqu'à l'intégration d'une API Business officielle.

Variables :

- `NOTIFICATION_WORKER_SECRET`
- `RESEND_API_KEY` / `EMAIL_FROM`
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` ou `TWILIO_MESSAGING_SERVICE_SID`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
- `OTP_HMAC_SECRET`
- `NOTIFICATION_EMAIL_WEBHOOK_URL` / `NOTIFICATION_EMAIL_WEBHOOK_TOKEN`
- `NOTIFICATION_SMS_WEBHOOK_URL` / `NOTIFICATION_SMS_WEBHOOK_TOKEN`
- `NOTIFICATION_PUSH_WEBHOOK_URL` / `NOTIFICATION_PUSH_WEBHOOK_TOKEN`

Le planificateur appelle `GET` ou `POST /api/notifications/worker` avec `Authorization: Bearer <NOTIFICATION_WORKER_SECRET>`. Le workflow GitHub `v3-notification-worker.yml` le fait toutes les cinq minutes après configuration de la variable `V3_APP_URL` et du secret `NOTIFICATION_WORKER_SECRET`. Sans fournisseur configuré, les livraisons ne sont jamais comptées comme réussies.

Générer les clés push avec `npm run notifications:vapid`. La clé privée ne doit jamais être commitée. `OTP_HMAC_SECRET` doit être un secret aléatoire indépendant d'au moins 32 caractères.

## Vérification OTP

Le code comporte six chiffres, expire après dix minutes et n'est stocké que sous forme de HMAC SHA-256. Un nouveau code ne peut être demandé qu'après 60 secondes, avec cinq demandes par heure et cinq essais par code. Le navigateur ne peut ni lire la table des défis ni choisir lui-même le statut `verified`.

L'OTP est envoyé immédiatement par Resend pour un email ou Twilio pour un téléphone. Une erreur fournisseur annule le défi ; aucun code fantôme n'est présenté comme envoyé.

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
- OTP expirant et illisible par le client ;
- propriété des abonnements push ;
- adaptateurs Resend et Twilio ;
- état de configuration visible dans la page de santé admin.
