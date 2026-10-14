# État après fiabilisation

- `/health` et `/ready` séparent disponibilité web et disponibilité base.
- Logs JSON structurés, identifiants de requête et suppression récursive des champs sensibles.
- Erreurs et maintenance accessibles en arabe, français et anglais.
- Sauvegarde chiffrée, restauration protégée et contrôle d'intégrité reproductible.
- Supervision Uptime Kuma autonome, configurations PM2/systemd et test de charge k6.
- Timeouts, retries exponentiels et circuit breaker appliqués aux dépendances externes critiques.

Le test de restauration complet exige une base PostgreSQL jetable et les outils `pg_dump`/`pg_restore`; il ne doit jamais être exécuté sur la production.
