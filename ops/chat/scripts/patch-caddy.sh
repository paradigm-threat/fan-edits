#!/usr/bin/env bash
# Idempotently insert /chat/api* + /chat/ws handles into park-tls Caddyfile for flashback.
# Park plugin rewrites Caddyfile.parked periodically — pair with flashback-chat-caddy-guard.
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
import re
import sys

path, mode, marker, out = sys.argv[1:5]
text = open(path).read()
# Apex only — www is usually a permanent redir site (no reverse_proxy).
hosts = ("flashbackrepository.org",)

if mode == "remote":
    block = f"""\t{marker}
\thandle /chat/api* {{
\t\treverse_proxy https://iad1.relaygateway.net {{
\t\t\theader_up Host flashbackrepository.org
\t\t\ttransport http {{
\t\t\t\ttls_server_name flashbackrepository.org
\t\t\t}}
\t\t}}
\t}}
\thandle /chat/ws {{
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
    start = src.find(f"{hostname} {{")
    if start < 0:
        return src
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
    # Skip redir-only / non-proxy sites
    if "\treverse_proxy" not in body and " reverse_proxy" not in body:
        return src
    if marker in body:
        body2 = re.sub(
            rf"\t{re.escape(marker)}\n(?:\thandle /chat/[^\n]*\n(?:\t\t[^\n]*\n)*\t}}\n)+",
            block,
            body,
            count=1,
        )
        if body2 == body:
            # Fallback: wipe from marker through next top-level reverse_proxy
            body2 = re.sub(
                rf"\t{re.escape(marker)}.*?(?=\treverse_proxy)",
                block,
                body,
                count=1,
                flags=re.S,
            )
        return src[:start] + body2 + src[end:]
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
changed = out_text != text
print(f"patched {path} mode={mode} changed={changed}")
PY

if ! cmp -s "${TMP}" "${PARKED}"; then
  cp "${TMP}" "${PARKED}"
  NEED_LOAD=1
else
  NEED_LOAD=0
  echo "park file already had chat handles (mode=${MODE})"
fi
rm -f "${TMP}"

if [[ "${NEED_LOAD}" -eq 1 ]] && command -v caddy >/dev/null && [[ -f /etc/caddy/Caddyfile ]]; then
  caddy validate --config /etc/caddy/Caddyfile 2>/dev/null || true
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
