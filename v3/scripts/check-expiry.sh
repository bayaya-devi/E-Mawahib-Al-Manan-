#!/usr/bin/env bash
set -euo pipefail
: "${DOMAIN:?DOMAIN is required}"
EXPIRY="$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)"
EXPIRY_EPOCH="$(date -d "$EXPIRY" +%s)"; NOW="$(date +%s)"; DAYS="$(( (EXPIRY_EPOCH-NOW)/86400 ))"
printf 'TLS certificate for %s expires in %s days.\n' "$DOMAIN" "$DAYS"
if [ "$DAYS" -le 7 ]; then exit 2; elif [ "$DAYS" -le 30 ]; then exit 1; fi
