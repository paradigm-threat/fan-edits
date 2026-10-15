#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIDEO="${1:-}"
if [[ -z "${VIDEO}" ]]; then
  echo "Usage: $0 /path/to/Pee-wee....mp4" >&2
  exit 1
fi
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/Pee-wee's Big Adventure (1985) - KidFriendly Edition.kdenlive"
python3 "${DIR}/build_remove_ranges.py"
python3 "${ROOT}/scripts/kdenlive_from_subs.py" \
  --video "${VIDEO}" \
  --subs "${DIR}/Pee-wee's Big Adventure (1985) - KidFriendly Edition.srt" \
  --join-fade-sec 0.35 \
  --join-fade-min-gap 72 \
  --remove-ranges-json "${DIR}/remove-pee-wee-kidfriendly-ranges.json" \
  --out "${OUT}"
echo "Wrote ${OUT}"
