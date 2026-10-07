#!/bin/sh
set -eu
DB_PATH="${DB_PATH:-/data/gipfelpass.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/gipfelpass-$STAMP.sqlite"
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$OUT'"
else
  cp "$DB_PATH" "$OUT"
fi
printf '%s\n' "$OUT"
