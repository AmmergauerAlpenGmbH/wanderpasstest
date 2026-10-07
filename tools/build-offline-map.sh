#!/usr/bin/env bash
set -euo pipefail
DATE="${1:-20260924}"
OUT="${2:-public/maps/ammergauer-alpen.pmtiles}"
BBOX="10.80,47.48,11.20,47.72"
command -v pmtiles >/dev/null 2>&1 || { echo "pmtiles CLI fehlt."; exit 1; }
pmtiles extract "https://build.protomaps.com/${DATE}.pmtiles" "$OUT" --bbox="$BBOX" --maxzoom=14
echo "Fertig: $OUT"
