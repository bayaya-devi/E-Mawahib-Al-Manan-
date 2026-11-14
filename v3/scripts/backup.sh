#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${BACKUP_INTEGRITY_KEY:?BACKUP_INTEGRITY_KEY is required}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly"
pg_dump --format=custom --schema=public --no-owner --no-acl "$DATABASE_URL" > "$WORK/database.dump"
node scripts/backup-storage.mjs "$WORK"
node scripts/backup-manifest.mjs "$WORK/backup-manifest.json" "$WORK/database.dump" "$WORK/storage-manifest.json"
tar -C "$WORK" -czf "$WORK/e-mawahib-$STAMP.tar.gz" database.dump storage storage-manifest.json backup-manifest.json
ARCHIVE="$BACKUP_ROOT/daily/e-mawahib-$STAMP.tar.gz.enc"
openssl enc -aes-256-cbc -salt -pbkdf2 -in "$WORK/e-mawahib-$STAMP.tar.gz" -out "$ARCHIVE" -pass env:BACKUP_ENCRYPTION_KEY
node scripts/backup-integrity.mjs sign "$ARCHIVE" "$ARCHIVE.integrity.json" >/dev/null
find "$BACKUP_ROOT/daily" -type f -mtime +7 -delete
if [ "$(date -u +%u)" = "7" ]; then cp "$ARCHIVE" "$BACKUP_ROOT/weekly/"; cp "$ARCHIVE.integrity.json" "$BACKUP_ROOT/weekly/"; fi
if [ "$(date -u +%d)" = "01" ]; then cp "$ARCHIVE" "$BACKUP_ROOT/monthly/"; cp "$ARCHIVE.integrity.json" "$BACKUP_ROOT/monthly/"; fi
find "$BACKUP_ROOT/weekly" -type f -mtime +42 -delete
find "$BACKUP_ROOT/monthly" -type f -mtime +400 -delete
printf '%s\n' "$ARCHIVE"
