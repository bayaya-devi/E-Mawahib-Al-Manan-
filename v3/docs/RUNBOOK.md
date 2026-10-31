# e-Mawahib Operations Runbook

## Detection

- Monitor `GET /health` every 60 seconds. It proves the web process can answer.
- Monitor `GET /ready` every 60 seconds. HTTP 503 means the application cannot safely serve database-backed traffic.
- Configure Uptime Kuma with two HTTP monitors and email or Telegram notification. Start locally with `docker compose -f docker-compose.monitoring.yml up -d`.

## First response

1. Record the UTC time and failing endpoint.
2. Check Vercel deployment state and function logs using the request ID returned by the endpoint.
3. Check Supabase status and database availability.
4. For a risky incident, set `MAINTENANCE_MODE=1` and redeploy. `/health`, `/ready`, and `/api/version` remain reachable.
5. Never disable RLS or expose the service-role key to restore service.

## Recovery

- Roll back application code to the last Ready Vercel deployment when the database is healthy.
- Follow `docs/DISASTER-RECOVERY.md` for database recovery.
- Remove maintenance mode only after `/ready` returns 200 and login plus one protected workflow are verified.

## Routine checks

- Daily: confirm health monitors and encrypted backup completion.
- Weekly: run `scripts/test-restore.sh` against a disposable database.
- Monthly: run `k6 run tests/load/smoke.js` and `DOMAIN=e-mawahib-al-manan.vercel.app scripts/check-expiry.sh`.
- Vercel owns serverless log retention/rotation. Self-hosted installations use systemd journal rotation or PM2 log rotation.
