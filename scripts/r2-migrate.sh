#!/usr/bin/env bash
#
# One-time copy of existing files from Supabase Storage -> Cloudflare R2.
# Object keys are preserved 1:1, so DB storage_path values stay valid.
#
# This script reads credentials from the environment and builds a throwaway
# rclone config (no secrets are written to the repo). Required env vars:
#
#   # Supabase S3 endpoint — Dashboard > Storage > Settings > S3 Connection
#   SUPABASE_S3_ENDPOINT   e.g. https://aecvsvhbhvofognnsgdu.supabase.co/storage/v1/s3
#   SUPABASE_S3_REGION     your project region, e.g. ap-southeast-1
#   SUPABASE_S3_KEY        # Dashboard > Storage > Settings > S3 Access Keys
#   SUPABASE_S3_SECRET
#
#   # R2 — same values you put in .env
#   R2_ACCOUNT_ID
#   R2_ACCESS_KEY_ID
#   R2_SECRET_ACCESS_KEY
#
# Requires: rclone, jq.  Usage:  bash scripts/r2-migrate.sh
set -euo pipefail

# Pull the R2_* credentials from .env so they don't need re-exporting. The
# Supabase S3 vars are separate credentials (from the Supabase dashboard) and
# must be exported manually before running this script.
if [ -f .env ]; then
  while IFS= read -r line; do
    case "$line" in
      R2_ACCOUNT_ID=*|R2_ACCESS_KEY_ID=*|R2_SECRET_ACCESS_KEY=*) export "$line" ;;
    esac
  done < .env
fi

: "${SUPABASE_S3_ENDPOINT:?set SUPABASE_S3_ENDPOINT}"
: "${SUPABASE_S3_REGION:?set SUPABASE_S3_REGION}"
: "${SUPABASE_S3_KEY:?set SUPABASE_S3_KEY}"
: "${SUPABASE_S3_SECRET:?set SUPABASE_S3_SECRET}"
: "${R2_ACCOUNT_ID:?set R2_ACCOUNT_ID}"
: "${R2_ACCESS_KEY_ID:?set R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?set R2_SECRET_ACCESS_KEY}"

BUCKETS=(uploads outputs examples)

RCLONE_CONF="$(mktemp)"
trap 'rm -f "$RCLONE_CONF"' EXIT
cat > "$RCLONE_CONF" <<EOF
[supabase]
type = s3
provider = Other
access_key_id = ${SUPABASE_S3_KEY}
secret_access_key = ${SUPABASE_S3_SECRET}
endpoint = ${SUPABASE_S3_ENDPOINT}
region = ${SUPABASE_S3_REGION}
force_path_style = true

[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
region = auto
EOF

echo ">> Copying buckets (keys preserved) ..."
for b in "${BUCKETS[@]}"; do
  echo ">> $b"
  rclone --config "$RCLONE_CONF" copy "supabase:$b" "r2:$b" \
    --progress --transfers=16 --checkers=32 --s3-no-check-bucket
done

echo
echo ">> Verifying object counts ..."
fail=0
for b in "${BUCKETS[@]}"; do
  s=$(rclone --config "$RCLONE_CONF" size "supabase:$b" --json | jq -r .count)
  r=$(rclone --config "$RCLONE_CONF" size "r2:$b" --json | jq -r .count)
  if [ "$s" = "$r" ]; then status=OK; else status=MISMATCH; fail=1; fi
  printf "  %-10s supabase=%-7s r2=%-7s %s\n" "$b" "$s" "$r" "$status"
done

echo
if [ "$fail" = 0 ]; then
  echo ">> Done. Counts match. Next: run scripts/rewrite-examples-urls.sql, then deploy."
else
  echo ">> Counts differ — re-run the copy (rclone is resumable) before cutover." >&2
  exit 1
fi
