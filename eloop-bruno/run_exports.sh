#!/usr/bin/env bash
set -euo pipefail

# Load env file if present
if [ -f .env ]; then
  # shellcheck disable=SC1091
  source .env
fi

DEST_DIR="./exports"
mkdir -p "$DEST_DIR"

download() {
  local file="$1"
  local out="$2"
  echo "Running $file -> $out"
  curl -sS "${NEXTAUTH_URL}/api/admin/export/table?${file}" -o "$out" || true
}

echo "Exporting users..."
curl -sS "${NEXTAUTH_URL}/api/admin/export/table?table=users&key=${CSV_EXPORT_KEY}" -o "$DEST_DIR/users.csv"

echo "Exporting registrations..."
curl -sS "${NEXTAUTH_URL}/api/admin/export/table?table=registrations&key=${CSV_EXPORT_KEY}" -o "$DEST_DIR/registrations.csv"

echo "Exporting scan_logs..."
curl -sS "${NEXTAUTH_URL}/api/admin/export/table?table=scan_logs&key=${CSV_EXPORT_KEY}" -o "$DEST_DIR/scan_logs.csv"

if [ -n "${EVENT_ID:-}" ]; then
  echo "Exporting checkpoint for event ${EVENT_ID}..."
  curl -sS "${NEXTAUTH_URL}/api/admin/export/checkpoint?event_id=${EVENT_ID}&key=${CSV_EXPORT_KEY}" -o "$DEST_DIR/checkpoint.csv"
else
  echo "EVENT_ID not set; skipping checkpoint export"
fi

echo "Exports saved to $DEST_DIR"
