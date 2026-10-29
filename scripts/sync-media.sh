#!/usr/bin/env bash
# Carica public/uploads/ nel bucket R2 (gdg-media). Servono le credenziali in .bucketkey:
#   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT (https://<ACCOUNT_ID>.r2.cloudflarestorage.com)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.bucketkey; set +a
AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY AWS_DEFAULT_REGION=auto \
  aws s3 sync public/uploads s3://gdg-media/ --endpoint-url "$R2_ENDPOINT" --no-progress
