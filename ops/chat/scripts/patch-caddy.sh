#!/usr/bin/env bash
# Idempotently insert /chat handles into park-tls Caddyfile for flashback hosts.
set -euo pipefail

PARKED="${1:-/opt/relay/state/park-tls/Caddyfile.parked}"
MODE="${CHAT_CADDY_MODE:-local}" # local = 127.0.0.1 chat-edge; remote = proxy to iad1

if [[ ! -f "${PARKED}" ]]; then
  echo "missing ${PARKED}" >&2
  exit 1
fi

MARKER="# flashback-chat-sidecar"
TMP="$(mktemp)"

python3 - "${PARKED}" "${MODE}" "${MARKER}" "${TMP}" <<'PY'
import sys
path, mode, marker, out = sys.argv[1:5]
text = open(path).read()
hosts = ("flashbackrepository.org", "www.flashbackrepository.org")

if mode == "remote":
    block = f"""\t{marker}
\thandle /chat/* {{
\t\treverse_proxy https://iad1.relaygateway.net {{
\t\t\theader_up Host flashbackrepository.org
\t\t\ttransport http {{
\t\t\t\ttls_server_name flashbackrepository.org
\t\t\t}}
\t\t}}
\t}}
"""
else:
    block = f"""\t{marker}
\thandle /chat/api* {{
\t\treverse_proxy 127.0.0.1:8098
\t}}
\thandle /chat/ws {{
\t\treverse_proxy 127.0.0.1:8098
\t}}
"""

def patch_site(src: str, hostname: str) -> str:
    # Find `hostname {` site block
    start = src.find(f"{hostname} {{")
    if start < 0:
        return src
    # end at matching closing brace at column 0-ish
    i = start
    depth = 0
    end = None
    while i < len(src):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
        i += 1
    if end is None:
        return src
    body = src[start:end]
    if marker in body:
        # replace existing flashback-chat block through next reverse_proxy or end
        import re
        body2 = re.sub(
            rf"\t{re.escape(marker)}.*?(?=\treverse_proxy|\Z)",
            block,
            body,
            count=1,
            flags=re.S,
        )
        return src[:start] + body2 + src[end:]
    # insert before first reverse_proxy in site
    rp = body.find("\treverse_proxy")
    if rp < 0:
        body2 = body + "\n" + block
    else:
        body2 = body[:rp] + block + body[rp:]
    return src[:start] + body2 + src[end:]

out_text = text
for h in hosts:
    out_text = patch_site(out_text, h)
open(out, "w").write(out_text)
print(f"patched {path} mode={mode}")
PY

cp "${TMP}" "${PARKED}"
rm -f "${TMP}"

if command -v caddy >/dev/null && [[ -f /etc/caddy/Caddyfile ]]; then
  caddy validate --config /etc/caddy/Caddyfile 2>/dev/null || true
  # Prefer admin API load — systemctl reload can fail on PrivateTmp /tmp namespace issues
  if curl -fsS http://127.0.0.1:2019/config/ >/dev/null 2>&1; then
    adapt="$(mktemp)"
    caddy adapt --config /etc/caddy/Caddyfile >"${adapt}"
    curl -fsS -X POST http://127.0.0.1:2019/load \
      -H 'Content-Type: application/json' \
      --data-binary @"${adapt}" >/dev/null || true
    rm -f "${adapt}"
  else
    systemctl reload caddy 2>/dev/null || systemctl restart caddy 2>/dev/null || true
  fi
fi

echo "Caddy park file updated: ${PARKED}"
