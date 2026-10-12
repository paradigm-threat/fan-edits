#!/usr/bin/env bash
# Upload (or server-side rename) Now showing masters on Bunny storage.
# Object basename = full display title, URL-safe only (A–Z a–z 0–9 _ - .).
# Never master.mkv; never parentheses / apostrophes / %encoding in the path.
#
# Env: ~/.config/flashback/bunny.env (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD,
#      BUNNY_STORAGE_REGION_HOST, BUNNY_CDN_HOST)
#
# Usage:
#   ./scripts/bunny-now-showing-put.sh put <slug> "<Display Title>" /path/to/file.mkv
#   ./scripts/bunny-now-showing-put.sh put-as <slug> <Remote_Safe_Name.ext> /path/to/file
#   ./scripts/bunny-now-showing-put.sh ladder <slug> "<Display Title>" <web.mkv> <mobile.mkv>
#       Uploads Title_Safe_web-1080p.mkv + Title_Safe_mobile-720p.mkv; prints streamHttps* lines.
#   ./scripts/bunny-now-showing-put.sh rename <slug> "<Display Title>" [source-name]
#       source-name defaults to master.mkv (legacy); destination is always titled.
#   ./scripts/bunny-now-showing-put.sh title "<Display Title>"   # print basename only
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
# Bunny S3 endpoint for CopyObject (region DE in bunny.env)
S3_ENDPOINT="${BUNNY_S3_ENDPOINT:-https://de-s3.storage.bunnycdn.com}"

title_to_basename() {
  python3 - "$1" <<'PY'
import re, sys
t = sys.argv[1]
for a, b in (("—", "-"), ("–", "-"), ("\u2019", "'"), ("\u2018", "'"), ("\u201c", ""), ("\u201d", "")):
    t = t.replace(a, b)
t = t.replace(" ", "_")
# Drop parens; apostrophe → underscore (no %27 in CDN URLs)
t = t.replace("(", "").replace(")", "")
t = t.replace("'", "_")
# Keep only unreserved path-safe chars
t = re.sub(r"[^A-Za-z0-9._-]+", "_", t)
t = re.sub(r"_+", "_", t).strip("._-")
if not t or t.lower() in ("master", "master.mkv", "master.mp4"):
    raise SystemExit(f"refusing basename derived from title: {sys.argv[1]!r}")
if not t.lower().endswith((".mkv", ".mp4")):
    t += ".mkv"
base = t.rsplit("/", 1)[-1]
if base.lower().startswith("master."):
    raise SystemExit(f"refusing master.* object name: {base}")
# Must not need percent-encoding
if re.search(r"[^A-Za-z0-9._-]", base):
    raise SystemExit(f"basename not URL-safe: {base}")
print(base, end="")
PY
}

cdn_url() {
  local slug="$1" base="$2"
  # Basename is already URL-safe — no percent-encoding.
  printf 'https://%s/now-showing/%s/%s\n' "$CDN" "$slug" "$base"
}

storage_put() {
  local remote_path="$1" local_file="$2"
  local url="https://${HOST}/${ZONE}/${remote_path}"
  echo "PUT $url" >&2
  # -T streams the file (do not use --data-binary @ — OOM on multi‑GB MKVs/MP4s)
  curl -sS --fail -X PUT \
    -H "AccessKey: ${PASS}" \
    -H "Content-Type: application/octet-stream" \
    -T "${local_file}" \
    "$url" >/dev/null
}

storage_delete() {
  local remote_path="$1"
  local url="https://${HOST}/${ZONE}/${remote_path}"
  echo "DELETE $url" >&2
  curl -sS -o /dev/null -w '%{http_code}' -X DELETE -H "AccessKey: ${PASS}" "$url" || true
  echo >&2
}

# Server-side copy via S3 CopyObject, then delete source (rename).
storage_rename() {
  local slug="$1" src_name="$2" dest_name="$3"
  if [[ "${src_name,,}" == "${dest_name,,}" ]]; then
    echo "source and dest identical: $dest_name" >&2
    return 0
  fi
  if [[ "${dest_name,,}" == master.* ]]; then
    echo "refusing rename destination master.*" >&2
    exit 1
  fi
  local src_key="now-showing/${slug}/${src_name}"
  local dest_key="now-showing/${slug}/${dest_name}"
  echo "S3 copy ${src_key} -> ${dest_key}" >&2
  AWS_ACCESS_KEY_ID="$ZONE" AWS_SECRET_ACCESS_KEY="$PASS" \
    aws --endpoint-url "$S3_ENDPOINT" s3 cp \
      "s3://${ZONE}/${src_key}" "s3://${ZONE}/${dest_key}" >&2
  echo "S3 delete ${src_key}" >&2
  AWS_ACCESS_KEY_ID="$ZONE" AWS_SECRET_ACCESS_KEY="$PASS" \
    aws --endpoint-url "$S3_ENDPOINT" s3 rm "s3://${ZONE}/${src_key}" >&2 || true
}

cmd="${1:-}"
case "$cmd" in
  title)
    title_to_basename "${2:?display title}"
    echo
    ;;
  put)
    slug="${2:?slug}"
    title="${3:?display title}"
    file="${4:?local file}"
    [[ -f "$file" ]] || { echo "missing file: $file" >&2; exit 1; }
    base="$(title_to_basename "$title")"
    remote="now-showing/${slug}/${base}"
    storage_put "$remote" "$file"
    echo "streamHttps=$(cdn_url "$slug" "$base")"
    ;;
  put-as)
    slug="${2:?slug}"
    base="${3:?remote basename}"
    file="${4:?local file}"
    [[ -f "$file" ]] || { echo "missing file: $file" >&2; exit 1; }
    if [[ "${base,,}" == master.* ]] || [[ "$base" == *"/"* ]] || [[ "$base" == *"%"* ]]; then
      echo "refusing unsafe remote basename: $base" >&2
      exit 1
    fi
    if ! [[ "$base" =~ ^[A-Za-z0-9._-]+$ ]]; then
      echo "remote basename not URL-safe: $base" >&2
      exit 1
    fi
    remote="now-showing/${slug}/${base}"
    storage_put "$remote" "$file"
    echo "url=$(cdn_url "$slug" "$base")"
    ;;
  ladder)
    slug="${2:?slug}"
    title="${3:?display title}"
    web="${4:?web-1080p file}"
    mob="${5:?mobile-720p file}"
    [[ -f "$web" ]] || { echo "missing web: $web" >&2; exit 1; }
    [[ -f "$mob" ]] || { echo "missing mobile: $mob" >&2; exit 1; }
    stem="$(title_to_basename "$title")"
    stem="${stem%.*}"
    # Ladder is MKV (remux of H.264/AAC); never .mp4 on Bunny for Now showing.
    web_base="${stem}_web-1080p.mkv"
    mob_base="${stem}_mobile-720p.mkv"
    storage_put "now-showing/${slug}/${web_base}" "$web"
    storage_put "now-showing/${slug}/${mob_base}" "$mob"
    echo "streamHttpsWeb=$(cdn_url "$slug" "$web_base")"
    echo "streamHttpsMobile=$(cdn_url "$slug" "$mob_base")"
    ;;
  rename)
    slug="${2:?slug}"
    title="${3:?display title}"
    src="${4:-master.mkv}"
    base="$(title_to_basename "$title")"
    if [[ "${src,,}" == master.* || "$src" != "$base" ]]; then
      storage_rename "$slug" "$src" "$base"
    fi
    echo "streamHttps=$(cdn_url "$slug" "$base")"
    ;;
  *)
    cat <<'EOF' >&2
Usage:
  bunny-now-showing-put.sh title "<Display Title>"
  bunny-now-showing-put.sh put <slug> "<Display Title>" /path/to/file.mkv
  bunny-now-showing-put.sh put-as <slug> <Remote_Safe_Name.ext> /path/to/file
  bunny-now-showing-put.sh ladder <slug> "<Display Title>" <web.mkv> <mobile.mkv>
  bunny-now-showing-put.sh rename <slug> "<Display Title>" [source-name]
Never uploads or renames to master.*
EOF
    exit 2
    ;;
esac
