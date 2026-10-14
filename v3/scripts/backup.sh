#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$WORK/database.dump"
node scripts/backup-storage.mjs "$WORK"
tar -C "$WORK" -czf "$WORK/e-mawahib-$STAMP.tar.gz" database.dump storage storage-manifest.json
openssl enc -aes-256-cbc -salt -pbkdf2 -in "$WORK/e-mawahib-$STAMP.tar.gz" -out "$BACKUP_ROOT/daily/e-mawahib-$STAMP.tar.gz.enc" -pass env:BACKUP_ENCRYPTION_KEY
find "$BACKUP_ROOT/daily" -type f -mtime +7 -delete
if [ "$(date -u +%u)" = "7" ]; then cp "$BACKUP_ROOT/daily/e-mawahib-$STAMP.tar.gz.enc" "$BACKUP_ROOT/weekly/"; fi
if [ "$(date -u +%d)" = "01" ]; then cp "$BACKUP_ROOT/daily/e-mawahib-$STAMP.tar.gz.enc" "$BACKUP_ROOT/monthly/"; fi
find "$BACKUP_ROOT/weekly" -type f -mtime +42 -delete
find "$BACKUP_ROOT/monthly" -type f -mtime +400 -delete
printf '%s\n' "$BACKUP_ROOT/daily/e-mawahib-$STAMP.tar.gz.enc"
