# Registre des traitements

> TODO-JURISTE : document technique à valider au regard de la loi marocaine 09-08, des formalités CNDP et, selon le public visé, du RGPD.

| Traitement | Données | Finalité | Base à valider | Conservation technique | Destinataires |
| --- | --- | --- | --- | --- | --- |
| Comptes | identité, rôle, statut, classe | fournir et sécuriser l’accès | contrat/intérêt légitime | durée du compte puis archivage contrôlé | administration habilitée |
| Dossier élève | naissance, sexe, particularités autorisées, documents | inscription et accompagnement | contrat/obligation légale/consentement selon le champ | durée scolaire + délai légal à confirmer | direction, administration, professeurs autorisés |
| Suivi pédagogique | sourates, versets, appréciations, devoirs, résultats | enseignement et information familiale | exécution du service éducatif | scolarité + délai à confirmer | élève, responsables liés, professeur, direction |
| Présence et incidents | présence, retard, absence, signalements | organisation et sécurité | intérêt légitime/obligation | durée scolaire + délai à confirmer | personnels autorisés |
| Finance | paiements, exonérations, salaires, écritures | comptabilité | obligation légale | durée comptable légale à confirmer | direction/comptabilité |
| Communication | messages, notifications, contacts vérifiés | échanges liés au service | contrat/intérêt légitime | compte actif puis archivage/purge définie | participants autorisés |
| Sécurité | audit, appareil, empreintes réseau hachées | prévenir fraude et incidents | intérêt légitime | durée minimale proportionnée | personnel sécurité habilité |
| Consentement public | choix, date, version, identifiant aléatoire haché | prouver le choix de confidentialité | consentement | 25 mois | direction habilitée |
| Médias publics | actualités, vidéos, interactions agrégées | information du public | intérêt légitime/consentement image | jusqu’au retrait | public |

Les mots de passe sont gérés et hachés par Supabase Auth. Les clés de service restent côté serveur. Les journaux applicatifs retirent les clés sensibles et ne conservent pas l’adresse IP brute.
