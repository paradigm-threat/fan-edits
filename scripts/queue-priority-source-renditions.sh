#!/usr/bin/env bash
# Priority SOURCE renders (Kdenlive/MLT → web/mobile) → ingest → catalog → mediaRoot → iad1
# Order: Van Helsing, Mummy Returns (2), Mummy (1)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
INGEST="${HOME}/dev/relay/relay-gateway/scripts/relay-ipfs-ingest"
LOG="/tmp/priority-source-renditions.log"
PRESET="${PRESET:-veryfast}"
VID_FM="/home/ari/Videos/FanEdits/FanMixes"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

render_title() {
  local project="$1" out_dir="$2" stem="$3" subs_dir="$4"
  log "SOURCE RENDER start: $stem"
  python3 scripts/render-web-from-kdenlive.py \
    --project "$project" \
    --out-dir "$out_dir" \
    --stem "$stem" \
    --subs-dir "$subs_dir" \
    --preset "$PRESET" \
    --which all \
    --force \
    2>&1 | tee -a "$LOG"
  log "SOURCE RENDER done: $stem"
  ls -lh "$out_dir/$stem".web-1080p.mkv "$out_dir/$stem".mobile-720p.mkv 2>&1 | tee -a "$LOG"
}

ingest_path() {
  local rel="$1"
  if [[ ! -e "$ROOT/$rel" ]]; then
    log "SKIP ingest missing $rel"
    return 0
  fi
  log "INGEST $rel"
  "$INGEST" "$rel" 2>&1 | tee -a "$LOG"
}

ingest_title() {
  local folder="$1"
  local dir="$ROOT/$folder"
  shopt -s nullglob
  for f in "$dir"/*.mkv "$dir"/*.web-1080p.mkv "$dir"/*.mobile-720p.mkv; do
    [[ -f "$f" || -L "$f" ]] || continue
    local base
    base="$(basename "$f")"
    case "$base" in
      *seam*|*preview*|*proxy*|*edit-1080*) continue ;;
    esac
    ingest_path "$folder/$base"
  done
  if [[ -d "$dir/subs" ]]; then
    python3 scripts/srt_to_vtt.py "$dir/subs" 2>&1 | tee -a "$LOG" || true
  fi
}

ensure_symlink() {
  local folder="$1" master_name="$2" render_name="$3"
  local dest="$ROOT/$folder/$master_name"
  local src="/media/ari/HD/FanEditRender/$render_name/$master_name"
  if [[ ! -e "$dest" && -f "$src" ]]; then
    ln -sfn "$src" "$dest"
    log "symlink $dest -> $src"
  fi
}

main() {
  : >"$LOG"
  log "Priority SOURCE pipeline start (ROOT=$ROOT preset=$PRESET)"

  # Kill any leftover master-transcode pipeline
  pkill -f "encode-web-renditions.py" 2>/dev/null || true
  pkill -f "queue-priority-renditions.sh" 2>/dev/null || true
  pkill -f "ffmpeg.*Van Helsing - DeAnna.*(web-1080p|mobile-720p)" 2>/dev/null || true

  ensure_symlink "FanMixes/Van Helsing - DeAnna'd" "Van Helsing - DeAnna'd.mkv" "Van Helsing - DeAnna'd"
  ensure_symlink "FanMixes/The Mummy Returns (2001) - Debugged" "The Mummy Returns Debugged.mkv" "The Mummy Returns (2001) - Debugged"
  if [[ ! -e "$ROOT/FanMixes/The Mummy (1999) - Debugged/The Mummy Debugged.mkv" ]]; then
    ensure_symlink "FanMixes/The Mummy (1999) - Debugged" "The Mummy Debugged.mkv" "The Mummy (1999) - Debugged"
  fi

  # Drop legacy H.264 MP4 ladder leftovers
  rm -f \
    "$ROOT/FanMixes/Van Helsing - DeAnna'd/"*.web-1080p.mp4 \
    "$ROOT/FanMixes/Van Helsing - DeAnna'd/"*.mobile-720p.mp4 \
    "$ROOT/FanMixes/The Mummy Returns (2001) - Debugged/"*.web-1080p.mp4 \
    "$ROOT/FanMixes/The Mummy Returns (2001) - Debugged/"*.mobile-720p.mp4 \
    "$ROOT/FanMixes/The Mummy (1999) - Debugged/"*.web-1080p.mp4 \
    "$ROOT/FanMixes/The Mummy (1999) - Debugged/"*.mobile-720p.mp4

  render_title \
    "$VID_FM/Van Helsing - DeAnna'd/Van Helsing - DeAnna'd.kdenlive" \
    "$ROOT/FanMixes/Van Helsing - DeAnna'd" \
    "Van Helsing - DeAnna'd" \
    "$ROOT/FanMixes/Van Helsing - DeAnna'd"
  ingest_title "FanMixes/Van Helsing - DeAnna'd"

  render_title \
    "$VID_FM/The Mummy Returns (2001) - Debugged/The Mummy Returns Debugged.kdenlive" \
    "$ROOT/FanMixes/The Mummy Returns (2001) - Debugged" \
    "The Mummy Returns Debugged" \
    "$ROOT/FanMixes/The Mummy Returns (2001) - Debugged"
  ingest_title "FanMixes/The Mummy Returns (2001) - Debugged"

  render_title \
    "$VID_FM/The Mummy (1999) - Debugged/The Mummy Debuggedv2.kdenlive" \
    "$ROOT/FanMixes/The Mummy (1999) - Debugged" \
    "The Mummy Debugged" \
    "$ROOT/FanMixes/The Mummy (1999) - Debugged"
  ingest_title "FanMixes/The Mummy (1999) - Debugged"

  log "Catalog + mediaRoot"
  python3 scripts/generate-index-json.py 2>&1 | tee -a "$LOG"
  python3 scripts/build-ipfs-media-root.py 2>&1 | tee -a "$LOG"

  log "DONE — stubs/index updated locally; commit + push iad1 when ready"
  log "Log: $LOG"
}

main "$@"
