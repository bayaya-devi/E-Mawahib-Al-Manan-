#!/usr/bin/env bash
set -euo pipefail
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_REGION:?BACKUP_S3_REGION is required}"
prefix="${BACKUP_S3_PREFIX:-e-mawahib}/"

cat >/tmp/e-mawahib-backup-lifecycle.json <<JSON
{
  "Rules": [{
    "ID": "e-mawahib-encrypted-backup-retention",
    "Filter": {"Prefix": "${prefix}"},
    "Status": "Enabled",
    "Transitions": [{"Days": 7, "StorageClass": "STANDARD_IA"}],
    "Expiration": {"Days": 400},
    "NoncurrentVersionExpiration": {"NoncurrentDays": 400}
  }]
}
JSON
AWS_DEFAULT_REGION="$BACKUP_S3_REGION" aws s3api put-bucket-lifecycle-configuration --bucket "$BACKUP_S3_BUCKET" --lifecycle-configuration file:///tmp/e-mawahib-backup-lifecycle.json
