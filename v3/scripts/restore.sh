#!/usr/bin/env bash
set -euo pipefail
: "${1:?encrypted backup path is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${BACKUP_INTEGRITY_KEY:?BACKUP_INTEGRITY_KEY is required}"
if [ "${ALLOW_DESTRUCTIVE_RESTORE:-}" != "YES" ]; then echo "Refusing restore: set ALLOW_DESTRUCTIVE_RESTORE=YES for a disposable target." >&2; exit 2; fi
if [[ "$RESTORE_DATABASE_URL" == *"mdgofogpghlwesaduxrq"* ]] || [ "${RESTORE_ISOLATED_TARGET:-}" != "YES" ]; then echo "Refusing restore: target must be explicitly isolated and cannot be DARALQURAN." >&2; exit 2; fi
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
node scripts/backup-integrity.mjs verify "$1" "$1.integrity.json"
openssl enc -d -aes-256-cbc -pbkdf2 -in "$1" -out "$WORK/backup.tar.gz" -pass env:BACKUP_ENCRYPTION_KEY
tar -C "$WORK" -xzf "$WORK/backup.tar.gz"
node -e 'const {createHash}=require("node:crypto");const{readFileSync}=require("node:fs");const manifest=JSON.parse(readFileSync(process.argv[1],"utf8"));for(const [file,hash] of Object.entries(manifest)){const actual=createHash("sha256").update(readFileSync(process.argv[2]+"/"+file)).digest("hex");if(actual!==hash)throw new Error("Backup content hash mismatch: "+file)}' "$WORK/backup-manifest.json" "$WORK"
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" < "$WORK/database.dump"
printf 'Database restored. Storage files are staged at %s/storage for controlled re-upload.\n' "$WORK"
