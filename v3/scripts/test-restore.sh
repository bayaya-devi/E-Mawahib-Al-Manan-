#!/usr/bin/env bash
set -euo pipefail
: "${1:?encrypted backup path is required}"
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL must target a disposable database}"
START="$(date +%s)"
RESTORE_DATABASE_URL="$TEST_DATABASE_URL" ALLOW_DESTRUCTIVE_RESTORE=YES scripts/restore.sh "$1"
for table in schools profiles classes user_roles audit_logs; do
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "select count(*) from public.$table" >/dev/null
done
printf 'Restore verification succeeded in %ss.\n' "$(( $(date +%s) - START ))"
