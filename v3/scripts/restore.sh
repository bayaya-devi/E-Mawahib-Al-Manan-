#!/usr/bin/env bash
set -euo pipefail
: "${1:?encrypted backup path is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
if [ "${ALLOW_DESTRUCTIVE_RESTORE:-}" != "YES" ]; then echo "Refusing restore: set ALLOW_DESTRUCTIVE_RESTORE=YES for a disposable target." >&2; exit 2; fi
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -in "$1" -out "$WORK/backup.tar.gz" -pass env:BACKUP_ENCRYPTION_KEY
tar -C "$WORK" -xzf "$WORK/backup.tar.gz"
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" "$WORK/database.dump"
printf 'Database restored. Storage files are staged at %s/storage for controlled re-upload.\n' "$WORK"
