# Theater / Fleet telemetry (no analytics SaaS)

Operators watch **relay-ops Fleet UI** (`http://127.0.0.1:7780`), not a SaaS inbox.

## Privacy: errors only on the client

We **refuse product analytics** and session-replay style tooling. The browser is not used to study people.

**What the client may send**

- Typed **failure / error** beacons when playback or page JS hard-fails (and optional sampled soft errors)
- Optional coarse page **vitals** already used by Relay RUM (LCP/TTFC-style), when RUM is enabled — not a clickstream
- **Affirmation-gated hit beacons** (`POST /api/hits`) — see below. Not a clickstream.

**What we deliberately do not monitor**

- Clicks, taps, scrolls, mouse movement, heatmaps
- Dwell time, funnel steps, “which title you lingered on”
- Play clicks, VLC / Open Network Stream opens, or byte-range / stream traffic as “views”
- Form field contents, clipboard, or keystrokes
- Third-party analytics (Google Analytics, Plausible-as-product-surveillance, Mixpanel, Amplitude, etc.)
- Sentry / GlitchTip / similar SaaS error inboxes that ship PII-prone stacks off-node by default

Watching how someone uses the theater would be an invasion of privacy. We only care whether **published media is broken** so operators can fix the mesh — counts and codes on our nodes, not profiles of viewers.

## Public hit counters (`/api/hits`)

Anonymous **localStorage-unique** counts, gated by the ownership affirmation checkboxes (bots that never check the box do not count). Fail closed if JS or `localStorage` is unavailable — no beacon, no increment.

| Kind | When | Meaning |
|------|------|---------|
| `site_view` | Welcome checkbox OK (front page) | “Walked into the lobby” once per browser profile |
| `movie_view` | Title affirmation OK (movie page) | “Entered that theater” once per browser profile — **not** staying for the film / play / VLC |

- No cookies, fingerprints, or client IPs in the payload.
- Fleet nodes mesh-sum peers’ local totals (cached ~60s) for the footer / movie line.
- Middleware HTML request stats remain for **operators** (`/api/status` → `http`); they are not the public “visitors” number.

## What lights up (operators)

| Signal | Source | Where in Fleet |
|--------|--------|----------------|
| Node unreachable / TLS / DNS | Existing HTTPS/TCP probes | Node red/warn |
| IPFS seed lag | `GET /api/status` → `ipfs_ok`, `repos[].ipfs` | Node “seed …” lines + per-repo seed ratio |
| Park host HTTP pressure | `http` blob on status (4xx/5xx, hosts; park host ★) | HTTP strip under the node |
| Theater major / minor counts | Viewer `POST /api/rum` typed **error** events → node SQLite → Fleet `GET /api/rum` | `theater major/24h` + top codes; minor secondary |

## Client error beacons

`hooks/client/native/telemetry.js` + TheaterPlayer call sites post same-origin:

```json
{
  "kind": "theater",
  "severity": "major",
  "code": "wasm_hard_fail",
  "path": "/van-helsing-deanna-d",
  "rendition": "master",
  "engine": "wasm",
  "message": "…"
}
```

**Major** (always): `mirrors_exhausted`, `seed_permanent_fail`, `wasm_hard_fail`, `post_play_collapse`, `native_hard_fail`, `user_report` (“Report a problem”).

**Minor** (sampled): `js_error` (~3%), `compat_fallback` (5%), `underrun_soft` (10%), `hydrate_fail` if wired.

**Not reported:** successful play, autoplay `NotAllowedError`, stub CIDs, user pause, navigation or UI interaction.

Readable public bug notes and comments are **not** RUM — they go on the git **`comments`** branch via [/board](/board). See [BOARD.md](BOARD.md).

## Enabling RUM on a node

Gateway env (see `relay.env.example` / install defaults):

- `RELAY_RUM_ENABLED=1`
- optional `RELAY_RUM_DIR` (default `/opt/relay/rum`)
- optional `RELAY_RUM_SAMPLE_RATE`, `RELAY_RUM_RETENTION_DAYS` (default 30)

`GET https://{node}/api/rum` returns 24h p75 vitals plus `theater24h` (`major`, `minor`, `byCode`, `bySeverityCode`).

## Explicit non-goals

- Product analytics, heatmaps, session replay, A/B behavioral tracking
- Sentry / GlitchTip / GitLab issue spam / email-per-event
- Shipping full `journalctl` into Fleet cards (SSH for deep dive)
- Per-frame performance telemetry
