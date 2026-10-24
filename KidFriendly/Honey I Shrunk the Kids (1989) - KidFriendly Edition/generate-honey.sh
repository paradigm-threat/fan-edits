#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIDEO="${1:-}"
if [[ -z "${VIDEO}" ]]; then
  echo "Usage: $0 /path/to/Honey.I.Shrunk.the.Kids....mkv" >&2
  exit 1
fi
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/Honey I Shrunk the Kids (1989) - KidFriendly Edition.kdenlive"
python3 "${ROOT}/scripts/kdenlive_from_subs.py" \
  --video "${VIDEO}" \
  --subs "${DIR}/Honey I Shrunk the Kids (1989) - KidFriendly Edition.srt" \
  --snap \
  --join-fade-sec 0.35 \
  --join-fade-min-gap 72 \
  --remove-ranges-json "${DIR}/remove-honey-kidfriendly-ranges.json" \
  --out "${OUT}"
echo "Wrote ${OUT}"
