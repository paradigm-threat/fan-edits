#!/usr/bin/env bash
# Priority encode → ingest → catalog → mediaRoot → push iad1
# Order: Van Helsing, Mummy Returns (2), Mummy (1)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
INGEST="${HOME}/dev/relay/relay-gateway/scripts/relay-ipfs-ingest"
LOG="/tmp/priority-renditions.log"
PRESET="${PRESET:-veryfast}"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

encode_one() {
  local folder="$1"
  log "ENCODE start: $folder (preset=$PRESET)"
  python3 scripts/encode-web-renditions.py "$folder" --preset "$PRESET" --which all 2>&1 | tee -a "$LOG"
  log "ENCODE done: $folder"
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
  local folder="$1" # FanMixes/...
  local dir="$ROOT/$folder"
  shopt -s nullglob
  for f in "$dir"/*.mkv "$dir"/*.web-1080p.mp4 "$dir"/*.mobile-720p.mp4; do
    [[ -f "$f" || -L "$f" ]] || continue
    local base
    base="$(basename "$f")"
    case "$base" in
      *seam*|*preview*|*proxy*|*edit-1080*) continue ;;
    esac
    ingest_path "$folder/$base"
  done
  # VTT sidecars (git text; convert if needed)
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

wait_van_helsing() {
  log "Waiting for in-flight Van Helsing ffmpeg…"
  # Wait until no Helsing ffmpeg and both outputs are large
  local web="$ROOT/FanMixes/Van Helsing - DeAnna'd/Van Helsing - DeAnna'd.web-1080p.mp4"
  local mob="$ROOT/FanMixes/Van Helsing - DeAnna'd/Van Helsing - DeAnna'd.mobile-720p.mp4"
  while pgrep -f "ffmpeg.*Van Helsing - DeAnna" >/dev/null 2>&1; do
    sleep 20
  done
  # Kill orphaned encode-web wrappers that finished children
  pkill -f "encode-web-renditions.py.*Van Helsing" 2>/dev/null || true
  sleep 2
  if [[ ! -f "$web" || $(stat -c%s "$web") -lt 50000000 ]]; then
    log "Van Helsing web incomplete — re-encoding"
    python3 scripts/encode-web-renditions.py "FanMixes/Van Helsing - DeAnna'd" --preset "$PRESET" --which web --force 2>&1 | tee -a "$LOG"
  fi
  if [[ ! -f "$mob" || $(stat -c%s "$mob") -lt 20000000 ]]; then
    log "Van Helsing mobile incomplete — re-encoding"
    python3 scripts/encode-web-renditions.py "FanMixes/Van Helsing - DeAnna'd" --preset "$PRESET" --which mobile --force 2>&1 | tee -a "$LOG"
  fi
  log "Van Helsing encodes ready: web=$(stat -c%s "$web") mobile=$(stat -c%s "$mob")"
}

main() {
  : >"$LOG"
  log "Priority pipeline start (ROOT=$ROOT)"

  ensure_symlink "FanMixes/Van Helsing - DeAnna'd" "Van Helsing - DeAnna'd.mkv" "Van Helsing - DeAnna'd"
  ensure_symlink "FanMixes/The Mummy Returns (2001) - Debugged" "The Mummy Returns Debugged.mkv" "The Mummy Returns (2001) - Debugged"
  # Mummy 1 may already be a real file in repo
  if [[ ! -e "$ROOT/FanMixes/The Mummy (1999) - Debugged/The Mummy Debugged.mkv" ]]; then
    ensure_symlink "FanMixes/The Mummy (1999) - Debugged" "The Mummy Debugged.mkv" "The Mummy (1999) - Debugged"
  fi

  wait_van_helsing
  ingest_title "FanMixes/Van Helsing - DeAnna'd"

  encode_one "FanMixes/The Mummy Returns (2001) - Debugged"
  ingest_title "FanMixes/The Mummy Returns (2001) - Debugged"

  encode_one "FanMixes/The Mummy (1999) - Debugged"
  ingest_title "FanMixes/The Mummy (1999) - Debugged"

  log "Catalog + mediaRoot"
  python3 scripts/generate-index-json.py 2>&1 | tee -a "$LOG"
  python3 scripts/build-ipfs-media-root.py 2>&1 | tee -a "$LOG"

  log "Stage thin stubs + catalog"
  git add \
    index.json assets.manifest.json IPFS_ROOT \
    .relay/assets/FanMixes/Van\ Helsing\ -\ DeAnna\'d/ \
    .relay/assets/FanMixes/The\ Mummy\ Returns\ \(2001\)\ -\ Debugged/ \
    .relay/assets/FanMixes/The\ Mummy\ \(1999\)\ -\ Debugged/ \
    "FanMixes/Van Helsing - DeAnna'd/subs" \
    "FanMixes/The Mummy Returns (2001) - Debugged/subs" \
    "FanMixes/The Mummy (1999) - Debugged/subs" \
    2>/dev/null || true

  if git diff --cached --quiet; then
    log "Nothing to commit"
  else
    git commit -m "$(cat <<'EOF'
feat: seed Van Helsing + Mummy ladder (MKV + web/mobile H.264)

Priority render/ingest for DeAnna'd / Debugged titles so fleet can serve
full-quality MKV with progressive MP4 fallbacks.
EOF
)"
    log "Committed $(git rev-parse --short HEAD)"
  fi

  log "Push metadata to iad1 (fleet)"
  git push iad1 HEAD:main 2>&1 | tee -a "$LOG"
  log "DONE — titles should resolve on fleet after pin catch-up"
}

main "$@"
