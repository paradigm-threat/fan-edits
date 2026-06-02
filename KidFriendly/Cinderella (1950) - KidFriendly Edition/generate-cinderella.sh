#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIDEO="${1:-}"
if [[ -z "${VIDEO}" ]]; then
  echo "Usage: $0 /path/to/Cinderella.1950....mkv" >&2
  exit 1
fi
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/Cinderella (1950) - KidFriendly Edition.kdenlive"
python3 "${ROOT}/scripts/kdenlive_from_subs.py" \
  --video "${VIDEO}" \
  --subs "${DIR}/Cinderella (1950) - KidFriendly Edition.srt" \
  --snap \
  --join-fade-sec 0.35 \
  --join-fade-min-gap 72 \
  --remove-ranges-json "${DIR}/remove-cinderella-kidfriendly-ranges.json" \
  --out "${OUT}"
echo "Wrote ${OUT}"
