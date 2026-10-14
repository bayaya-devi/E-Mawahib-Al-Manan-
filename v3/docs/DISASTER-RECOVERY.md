# Disaster Recovery

## Safety rules

- Backups contain sensitive school data and must remain encrypted at rest.
- Test restores only against an empty, disposable database.
- Never point `RESTORE_DATABASE_URL` or `TEST_DATABASE_URL` at production.
- Keep the encryption key outside the backup location.

## Backup

Install PostgreSQL client tools, Node.js and OpenSSL. Export `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `BACKUP_ENCRYPTION_KEY`, then run `scripts/backup.sh`. The archive contains a custom PostgreSQL dump plus downloaded Storage objects and a manifest. Retention is 7 daily, 6 weekly, and about 13 monthly copies.

## Restore rehearsal

Provision a disposable PostgreSQL database, export `TEST_DATABASE_URL`, then run `scripts/test-restore.sh backups/daily/<archive>.enc`. Success requires the core school, identity, class, role, and audit tables to be readable. The command reports elapsed time.

Storage objects are extracted for controlled re-upload after database integrity is confirmed. Verify object counts against `storage-manifest.json` before reopening uploads.

## Production recovery

1. Enable maintenance mode.
2. Preserve the damaged database for investigation.
3. Restore the selected encrypted archive into a replacement database.
4. Verify core table counts, RLS policies, Auth identities, storage manifest, and `/ready`.
5. Switch application secrets to the replacement project.
6. Test admin, teacher, student and public read paths.
7. Disable maintenance mode and monitor for 30 minutes.

Recovery point equals the latest successful backup. Recovery time must be measured by weekly rehearsal rather than guessed.
