# Operations Runbook V3

## Controle Quotidien

Ouvrir `Administration > سلامة النظام`, verifier DB/Auth/Storage, comptes sans profil, eleves sans classe, classes sans professeur et synchronisations bloquees. Examiner ensuite les erreurs structurees et la file « A traiter ».

## Incident

1. Noter heure, utilisateur/role, page et identifiant de requete sans copier de donnee sensible.
2. Evaluer: confidentialite, integrite, disponibilite.
3. Si critique, stopper le module ou son feature flag.
4. Preserver logs et audit; ne pas corriger directement les lignes au hasard.
5. Reproduire en staging avec donnees anonymes.
6. Corriger avec test de regression, puis publier selon checklist.

## Synchronisation

`pending` attend, `syncing` est en cours, `failed` peut etre repris, `conflict` exige une decision. Ne jamais vider IndexedDB avant d'avoir exporte/identifie les mutations. Les recus serveur permettent de confirmer les repetitions deja terminees.

## Ancienne Version PWA

Verifier la version de `sw.js`, demander l'activation via la banniere, attendre `controllerchange`, puis recharger. En dernier recours seulement: desinscrire le worker et purger les caches e-Mawahib, apres verification de la queue offline.

## Comptes Suspendus

Confirmer le statut DB, revoquer les sessions Supabase si necessaire, verifier que le proxy refuse l'espace et que RLS ne renvoie aucune donnee metier. Ne jamais supprimer le dossier pour suspendre un acces.

## Release

Executer `npm ci`, `npm run security:secrets`, `npm run security:audit`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run test:e2e`, `npm run build`. En staging, executer migrations, tests RLS reels, upload prive, MFA, PWA upgrade et restauration. Deux personnes valident la bascule.

## Contacts Et Secrets

Les noms des operateurs, contacts d'urgence et emplacements de secrets restent dans le coffre de l'association, jamais dans Git. Les logs ne contiennent ni token, mot de passe, salaire, telephone, document ni payload prive.
