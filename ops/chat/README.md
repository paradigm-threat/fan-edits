# Flashback chat sidecar (Ergo + chat-edge)

Off-repo live chat for [flashbackrepository.org](https://flashbackrepository.org). Data lives under `/opt/relay/chat/` on **iad1**; ord1/hkg1 reverse-proxy `/chat/*` to iad1.

**Name note:** Relay deliberately echoes IRC — a network of servers that hop messages and stay in sync across netsplits. The same mental model as tip mesh (`POST /hooks/peer`) and multi-A edges. Mesh IRC here is the human + low-rate ops pubsub plane; git tip sync and `relay-ops` probe remain the authority.

**Multi-repo channels:** short prefixes `fb` / `ct` / `pt` — see Relay `relay-gateway/docs/RELAY_CHAT.md`. Shared UI hosts: `relay-web-assets/assets/chat/` (sources: `relay-client-web/park-native/chat/`).

## Components

| Piece | Role |
|-------|------|
| **Ergo** | IRCv3 on `:6667` / `:6697` (+ local WS `8097`) |
| **chat-edge** | `GET /chat/api/{health,history,channels,name}` + JSON `WS /chat/ws` bridged to IRC |
| **irc-agent** | Per-node bot (nick=`iad1`/`ord1`/`hkg1`) — journald allowlist + emit API → `#logs` / `#relay` / `#relay-stats` |
| **Logger** | Inside chat-edge — appends PRIVMSG to `/opt/relay/chat/logs/<channel>/<date>.jsonl` |
| **Backup timer** | Daily tar + rsync mirrors to peers |

## Install

On **iad1** (from this directory or a rsync’d copy):

```bash
sudo ./install.sh
```

On **ord1** / **hkg1**:

```bash
sudo ./install.sh --edge-only
```

## Public paths (same-origin)

- `GET /chat/api/health`
- `GET /chat/api/history?channel=movie-slug&limit=50`
- `GET /chat/api/channels?q=`
- `GET /chat/api/name?mode=theater|cut-room`
- `WS /chat/ws` — JSON `{type:join|privmsg|nick|part|ping,…}`

## Public IRC (standard ports)

| Port | Mode | Where |
| --- | --- | --- |
| **6697** | TLS (Flashback park cert) | Ergo on iad1; ord1/hkg1 TCP-proxy via `flashback-irc-proxy@6697` |
| **6667** | Plain | Same |

Host for clients: `flashbackrepository.org` (any edge A record). Lobby: `#flashback`.

## Channels

**Public (web + IRC clients):**

- `#flashback` lobby
- `#movie-<slug>`
- `#page-<path>` (`page-home`, `page-setup`, …)

**Ops bus (not listed in `GET /chat/api/channels`):**

- `#logs` — rate-limited journal / gateway emit lines (`nick | level | unit | text`)
- `#relay` — tip apply / mesh event chatter
- `#relay-stats` — compact node heartbeats

Join ops channels from a normal IRC client on `flashbackrepository.org:6697` (operator-oriented; keep PII out of `#logs`).

### irc-agent

Installed by `install.sh` (primary and `--edge-only`). Emits to local Ergo (iad1) or the edge TCP proxy (`127.0.0.1:6667` → iad1).

```bash
# Health / manual emit (loopback only)
curl -s http://127.0.0.1:8099/health
curl -s -X POST http://127.0.0.1:8099/emit \
  -H 'content-type: application/json' \
  -d '{"channel":"#logs","level":"info","component":"ops","text":"hello"}'
```

Gateway nodes with `RELAY_IRC_EVENTS=1` POST tip/mesh/park lines to this emit API.

## Persistence

| Store | Path | Survives reboot? |
|-------|------|------------------|
| Web history (JSONL) | `/opt/relay/chat/logs/<channel>/<day>.jsonl` | **Yes** |
| Channel index | `/opt/relay/chat/channels.json` | **Yes** |
| Ergo accounts/channels | `/opt/relay/chat/ergo/ircd.db` | **Yes** |
| Ergo CHATHISTORY | `/opt/relay/chat/ergo/ergo_history.db` (SQLite) | **Yes** (enabled) |
| In-RAM Ergo buffer | (none on disk) | No — persistence covers this |

`pt-*` JSONL dirs (Paradigm Threat import) are retained much longer than the default 90-day prune (`CHAT_PT_RETENTION_DAYS`, default 3650).

### Import PT `chat/public` → JSONL

```bash
# On a workstation with paradigm-threat-site checked out:
node ops/chat/scripts/import-pt-chat-public.mjs --dry-run
node ops/chat/scripts/import-pt-chat-public.mjs --apply --chat-root=/tmp/pt-import
# Then rsync /tmp/pt-import/logs/pt-* → iad1:/opt/relay/chat/logs/
```

Maps `general` → `pt-general`, etc. Does **not** PRIVMSG-replay into live IRC.

### Backups

Daily timer runs `scripts/backup.sh` on iad1:

- Tar: `logs/`, `channels.json`, `ergo/ircd.db`, `ergo/ircd.yaml`, `ergo/ergo_history.db`
- Rsync logs + archive → ord1/hkg1 `logs-mirror` / `backups-mirror`
- Optional: `CHAT_BACKUP_LOCAL=/home/ari/backups/relay-chat` on the timer host

Laptop cold pull:

```bash
./ops/chat/scripts/pull-chat-backup-local.sh
# CHAT_BACKUP_LOCAL=~/backups/relay-chat ./ops/chat/scripts/pull-chat-backup-local.sh
```

### Restore (sketch)

```bash
sudo systemctl stop flashback-chat-edge flashback-ergo
sudo rsync -a ~/backups/relay-chat/logs/ /opt/relay/chat/logs/
sudo cp -a ~/backups/relay-chat/channels.json /opt/relay/chat/channels.json
sudo cp -a ~/backups/relay-chat/ergo/*.db /opt/relay/chat/ergo/
sudo systemctl start flashback-ergo flashback-chat-edge
```

## Ops note

Never `POST /load` an empty body to Caddy admin — it drops :443 listeners. Prefer `systemctl restart caddy` after ensuring `/tmp` exists (1777). On nodes where park-tls already defines `flashbackrepository.org`, use `patch-caddy.sh` only — do not also `import` `Caddyfile.flashback` (ambiguous site).

Park plugin rewrites `/opt/relay/state/park-tls/Caddyfile.parked`. Current `relay-gateway` embeds `# flashback-chat-sidecar` handles when generating that file (and unions all cert dirs so a single-domain cert fan-out cannot wipe Flashback). `flashback-chat-caddy-guard.path` + `.timer` still re-run `ensure-caddy-chat.sh` as a belt-and-suspenders check. Emergency rebuild: `sudo python3 /opt/relay/chat/scripts/restore-park-chat.py`. Manual patch: `sudo CHAT_CADDY_MODE=local|remote /opt/relay/chat/scripts/patch-caddy.sh`.
