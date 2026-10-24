#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIDEO="${1:-}"
if [[ -z "${VIDEO}" ]]; then
  echo "Usage: $0 /path/to/Baby.Secret.Of.The.Lost.Legend....mp4" >&2
  exit 1
fi
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/Baby Secret of the Lost Legend (1985) - KidFriendly Edition.kdenlive"
python3 "${ROOT}/scripts/kdenlive_from_subs.py" \
  --video "${VIDEO}" \
  --subs "${DIR}/Baby Secret of the Lost Legend (1985) - KidFriendly Edition.srt" \
  --keep-full-timeline \
  --snap \
  --join-fade-sec 0.35 \
  --join-fade-min-gap 72 \
  --remove-ranges-json "${DIR}/remove-baby-kidfriendly-ranges.json" \
  --out "${OUT}"
echo "Wrote ${OUT}"
