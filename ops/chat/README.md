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

## Public IRC (standard ports)

| Port | Mode | Where |
| --- | --- | --- |
| **6697** | TLS (Flashback park cert) | Ergo on iad1; ord1/hkg1 TCP-proxy via `flashback-irc-proxy@6697` |
| **6667** | Plain | Same |

Host for clients: `flashbackrepository.org` (any edge A record). Lobby: `#flashback`.

## Channels

- `#flashback` lobby
- `#movie-<slug>`
- `#page-<path>` (`page-home`, `page-setup`, …)

## Ops note

Never `POST /load` an empty body to Caddy admin — it drops :443 listeners. Prefer `systemctl restart caddy` after ensuring `/tmp` exists (1777). On nodes where park-tls already defines `flashbackrepository.org`, use `patch-caddy.sh` only — do not also `import` `Caddyfile.flashback` (ambiguous site).

Park plugin rewrites `/opt/relay/state/park-tls/Caddyfile.parked`. Current `relay-gateway` embeds `# flashback-chat-sidecar` handles when generating that file (and unions all cert dirs so a single-domain cert fan-out cannot wipe Flashback). `flashback-chat-caddy-guard.path` + `.timer` still re-run `ensure-caddy-chat.sh` as a belt-and-suspenders check. Emergency rebuild: `sudo python3 /opt/relay/chat/scripts/restore-park-chat.py`. Manual patch: `sudo CHAT_CADDY_MODE=local|remote /opt/relay/chat/scripts/patch-caddy.sh`.
