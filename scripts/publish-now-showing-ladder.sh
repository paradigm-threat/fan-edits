#!/usr/bin/env bash
# Update now-showing.json streamHttps* for a slug, regenerate index.json, push tip to iad1.
# Usage: publish-now-showing-ladder.sh <slug> [streamHttpsWeb] [streamHttpsMobile]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLUG="${1:?slug}"
WEB_URL="${2:-}"
MOB_URL="${3:-}"

python3 - "$ROOT/now-showing.json" "$SLUG" "$WEB_URL" "$MOB_URL" <<'PY'
import json, sys
from pathlib import Path
path, slug, web, mob = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
rows = json.loads(path.read_text())
out = []
found = False
for row in rows:
    if isinstance(row, str):
        row = {"slug": row}
    if row.get("slug") == slug:
        found = True
        if web:
            row["streamHttpsWeb"] = web
        if mob:
            row["streamHttpsMobile"] = mob
    out.append(row)
if not found:
    raise SystemExit(f"slug not in now-showing.json: {slug}")
path.write_text(json.dumps(out, indent=2) + "\n")
print(f"updated {path} slug={slug}")
PY

python3 "$ROOT/scripts/generate-index-json.py"

# Publish via clean worktree (main tree is often dirty with FanMixes)
WT="/tmp/fan-edits-now-showing-publish-$$"
TIP="$(git -C "$ROOT" ls-remote iad1 refs/heads/main | awk '{print $1}')"
git -C "$ROOT" worktree prune
rm -rf "$WT"
git -C "$ROOT" worktree add --detach "$WT" "$TIP"
cp -a "$ROOT/now-showing.json" "$WT/now-showing.json"
cp -a "$ROOT/index.json" "$WT/index.json"
# also ship helper scripts if changed
for f in scripts/bunny-now-showing-put.sh scripts/encode-ladder-nvenc.sh scripts/publish-now-showing-ladder.sh docs/BUNNY_NOW_SHOWING_PLAN.md; do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$WT/$(dirname "$f")"
    cp -a "$ROOT/$f" "$WT/$f"
  fi
done
cd "$WT"
git checkout -B "now-showing-ladder-$SLUG"
git add now-showing.json index.json \
  scripts/bunny-now-showing-put.sh scripts/encode-ladder-nvenc.sh scripts/publish-now-showing-ladder.sh \
  docs/BUNNY_NOW_SHOWING_PLAN.md 2>/dev/null || true
if git diff --cached --quiet; then
  echo "nothing to publish"
else
  git commit -m "$(cat <<EOF
feat: Bunny Now showing ladder for ${SLUG}

EOF
)"
  git push iad1 HEAD:main || true
fi
NEW="$(git ls-remote iad1 refs/heads/main | awk '{print $1}')"
echo "iad1 main=$NEW"
cd "$ROOT"
git worktree remove --force "$WT" 2>/dev/null || rm -rf "$WT"
git worktree prune
curl -sS -o /dev/null -w 'live now-showing.json HTTP %{http_code}\n' \
  "https://flashbackrepository.org/now-showing.json?$(date +%s)" || true
