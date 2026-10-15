#!/usr/bin/env bash
# Upload lobby OST audio to Bunny storage under lobby/<song>/…
#
# Env: ~/.config/flashback/bunny.env
#
# Usage:
#   ./scripts/bunny-lobby-put.sh put <song> <Remote_Safe_Name.mp3> /path/to/file
#   ./scripts/bunny-lobby-put.sh put-dir <song> /path/to/dir/*.mp3
#   ./scripts/bunny-lobby-put.sh url <song> <Remote_Safe_Name.mp3>
set -euo pipefail

ENV_FILE="${BUNNY_ENV_FILE:-$HOME/.config/flashback/bunny.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

ZONE="${BUNNY_STORAGE_ZONE:?set BUNNY_STORAGE_ZONE}"
PASS="${BUNNY_STORAGE_PASSWORD:?set BUNNY_STORAGE_PASSWORD}"
HOST="${BUNNY_STORAGE_REGION_HOST:-storage.bunnycdn.com}"
CDN="${BUNNY_CDN_HOST:-flashbackrepository.b-cdn.net}"

safe_name() {
  python3 - "$1" <<'PY'
import re, sys
t = sys.argv[1].rsplit("/", 1)[-1]
t = t.replace(" ", "_")
t = re.sub(r"[^A-Za-z0-9._-]+", "_", t)
t = re.sub(r"_+", "_", t).strip("._-")
if not t.lower().endswith((".mp3", ".m4a", ".aac", ".ogg", ".wav")):
    t += ".mp3"
if re.search(r"[^A-Za-z0-9._-]", t):
    raise SystemExit(f"basename not URL-safe: {t}")
print(t, end="")
PY
}

cdn_url() {
  local song="$1" base="$2"
  printf 'https://%s/lobby/%s/%s\n' "$CDN" "$song" "$base"
}

storage_put() {
  local remote_path="$1" local_file="$2" ctype="${3:-audio/mpeg}"
  local url="https://${HOST}/${ZONE}/${remote_path}"
  echo "PUT $url" >&2
  curl -sS --fail -X PUT \
    -H "AccessKey: ${PASS}" \
    -H "Content-Type: ${ctype}" \
    -T "${local_file}" \
    "$url" >/dev/null
}

cmd="${1:-}"
case "$cmd" in
  put)
    song="${2:?song (public-domain|christmas)}"
    remote="${3:?remote name}"
    local_file="${4:?local file}"
    base="$(safe_name "$remote")"
    storage_put "lobby/${song}/${base}" "$local_file"
    cdn_url "$song" "$base"
    ;;
  put-dir)
    song="${2:?song}"
    shift 2
    if [[ $# -lt 1 ]]; then
      echo "put-dir needs files" >&2
      exit 1
    fi
    for f in "$@"; do
      base="$(safe_name "$(basename "$f")")"
      storage_put "lobby/${song}/${base}" "$f"
      cdn_url "$song" "$base"
    done
    ;;
  url)
    song="${2:?song}"
    base="$(safe_name "${3:?name}")"
    cdn_url "$song" "$base"
    ;;
  *)
    cat >&2 <<'EOF'
Usage:
  bunny-lobby-put.sh put <song> <Remote_Safe_Name.mp3> /path/to/file
  bunny-lobby-put.sh put-dir <song> /path/to/*.mp3
  bunny-lobby-put.sh url <song> <Remote_Safe_Name.mp3>
EOF
    exit 1
    ;;
esac
