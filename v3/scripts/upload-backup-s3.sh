#!/usr/bin/env bash
set -euo pipefail
: "${1:?encrypted backup path is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_REGION:?BACKUP_S3_REGION is required}"

archive="$1"
sidecar="${archive}.integrity.json"
test -f "$sidecar"
prefix="${BACKUP_S3_PREFIX:-e-mawahib}/$(date -u +%Y/%m/%d)"
destination="s3://${BACKUP_S3_BUCKET}/${prefix}/"
args=(s3 cp --only-show-errors --sse AES256)
if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then args+=(--endpoint-url "$BACKUP_S3_ENDPOINT"); fi

AWS_DEFAULT_REGION="$BACKUP_S3_REGION" aws "${args[@]}" "$archive" "$destination"
AWS_DEFAULT_REGION="$BACKUP_S3_REGION" aws "${args[@]}" "$sidecar" "$destination"
printf '%s\n' "$destination"
