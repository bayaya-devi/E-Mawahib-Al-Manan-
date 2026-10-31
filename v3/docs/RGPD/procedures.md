# Procédures vie privée

> TODO-JURISTE : valider les délais, bases légales, mentions destinées aux mineurs et formalités CNDP.

## Exercice des droits

L’utilisateur authentifié télécharge son export JSON depuis Paramètres. Il peut déposer une demande de rectification, restriction ou effacement. La demande est horodatée et auditée. L’administration vérifie l’identité et les obligations de conservation avant exécution. Un dossier scolaire ou comptable ne doit jamais être détruit automatiquement.

## Effacement et anonymisation

1. Vérifier l’identité et l’autorité parentale le cas échéant.
2. Recenser les obligations de conservation.
3. Archiver le compte pour bloquer l’accès.
4. Anonymiser les champs sans obligation de conservation et préserver les écritures qui doivent rester probantes.
5. Documenter la décision dans la demande et l’audit.

## Conservation

Le cron `/api/privacy/retention` purge quotidiennement les preuves de consentement de plus de 25 mois, les challenges de vérification expirés depuis 30 jours et les reçus de synchronisation de plus de 90 jours. Le secret cron est serveur uniquement. Les données pédagogiques, familiales et comptables nécessitent une décision de conservation validée juridiquement avant purge.

## Violation de données

Appliquer le runbook d’incident, préserver les preuves, évaluer les personnes touchées, documenter la chronologie et consulter le responsable juridique/CNDP sur les notifications requises.
