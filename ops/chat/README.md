# Flashback chat sidecar (Ergo + chat-edge)

Off-repo live chat for [flashbackrepository.org](https://flashbackrepository.org). Data lives under `/opt/relay/chat/` on **iad1**; ord1/hkg1 reverse-proxy `/chat/*` to iad1.

## Components

| Piece | Role |
|-------|------|
| **Ergo** | IRCv3 on `127.0.0.1:6667` (+ optional WS `8097`) |
| **chat-edge** | `GET /chat/api/{health,history,channels,name}` + JSON `WS /chat/ws` bridged to IRC |
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

## Channels

- `#flashback` lobby
- `#movie-<slug>`
- `#page-<path>` (`page-home`, `page-setup`, …)

## Ops note

Never `POST /load` an empty body to Caddy admin — it drops :443 listeners. Prefer `systemctl restart caddy` after ensuring `/tmp` exists (1777). On nodes where park-tls already defines `flashbackrepository.org`, use `patch-caddy.sh` only — do not also `import` `Caddyfile.flashback` (ambiguous site).

Park plugin periodically rewrites `/opt/relay/state/park-tls/Caddyfile.parked` and can wipe chat handles. `flashback-chat-caddy-guard.path` + `.timer` re-run `ensure-caddy-chat.sh` when that happens (and every 2 minutes). Manual: `sudo CHAT_CADDY_MODE=local|remote /opt/relay/chat/scripts/patch-caddy.sh`.
