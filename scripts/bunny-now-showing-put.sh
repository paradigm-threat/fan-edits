#!/usr/bin/env bash
# Upload (or server-side rename) Now showing masters on Bunny storage.
# Object basename = full display title, spaces → underscores. Never master.mkv.
#
# Env: ~/.config/flashback/bunny.env (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD,
#      BUNNY_STORAGE_REGION_HOST, BUNNY_CDN_HOST)
#
# Usage:
#   ./scripts/bunny-now-showing-put.sh put <slug> "<Display Title>" /path/to/file.mkv
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
  local t="$1"
  # em/en dash → ASCII hyphen; smart quotes → ASCII
  t="${t//—/-}"
  t="${t//–/-}"
  t="${t//’/'}"
  t="${t//‘/'}"
  t="${t//“/}"
  t="${t//”/}"
  t="${t// /_}"
  # refuse empty / master
  if [[ -z "$t" || "$t" == "master" || "$t" == "master.mkv" || "$t" == "master.mp4" ]]; then
    echo "refusing basename derived from title: '$1'" >&2
    exit 1
  fi
  if [[ "$t" != *.mkv && "$t" != *.mp4 ]]; then
    t="${t}.mkv"
  fi
  # basename must not be master.*
  local base="${t##*/}"
  if [[ "${base,,}" == master.* ]]; then
    echo "refusing master.* object name: $base" >&2
    exit 1
  fi
  printf '%s' "$base"
}

cdn_url() {
  local slug="$1" base="$2"
  # URL-encode path segment (keep common safe chars)
  python3 - "$CDN" "$slug" "$base" <<'PY'
import sys, urllib.parse
cdn, slug, base = sys.argv[1], sys.argv[2], sys.argv[3]
enc = urllib.parse.quote(base, safe="()._-'")
print(f"https://{cdn}/now-showing/{slug}/{enc}")
PY
}

storage_put() {
  local remote_path="$1" local_file="$2"
  local url="https://${HOST}/${ZONE}/${remote_path}"
  echo "PUT $url" >&2
  curl -sS --fail -X PUT \
    -H "AccessKey: ${PASS}" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"${local_file}" \
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
  bunny-now-showing-put.sh rename <slug> "<Display Title>" [source-name]
Never uploads or renames to master.*
EOF
    exit 2
    ;;
esac
