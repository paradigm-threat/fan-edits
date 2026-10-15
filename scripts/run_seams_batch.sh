#!/usr/bin/env bash
# Sequential seams.mkv QC reels. Generic name only. Syncs HDD → Videos → NAS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HDD="/media/ari/HD/FanEditRender"
VIDEOS="/home/ari/Videos/FanEdits/FanMixes"
NAS="nobiserv.local:/share/Public/Videos/FanEdits/FanMixes"
PY="$ROOT/scripts/render_seams.py"

render_one() {
  local folder="$1"
  shift
  local dest="$HDD/$folder"
  local out="$dest/seams.mkv"
  local log="$dest/seams-render.log"
  mkdir -p "$dest"
  echo "======== SEAMS START $folder $(date -Is) ========" | tee -a "$log"
  python3 "$PY" --project "$ROOT/FanMixes/$folder" --out "$out" "$@" 2>&1 | tee -a "$log"
  mkdir -p "$VIDEOS/$folder"
  rsync -aP "$out" "$VIDEOS/$folder/seams.mkv"
  rsync -aP "$out" "$NAS/$folder/seams.mkv"
  echo "======== SEAMS DONE $folder $(date -Is) ========" | tee -a "$log"
  ls -lh "$out" | tee -a "$log"
}

# 1) Mummy 2 — replacement credits + metal beds
render_one "The Mummy Returns (2001) - Debugged" \
  --credits-start 01:53:00 \
  --melt-mlt "$HDD/The Mummy Returns (2001) - Debugged/The Mummy Returns Debugged.render.mlt"

# 2) Mummy 1
render_one "The Mummy (1999) - Debugged"

# 3) Remaining projects (video override via --video if passed as extra args later)
# Driver continues in run_seams_rest.py so missing rips can be resolved.
python3 "$ROOT/scripts/run_seams_rest.py"
