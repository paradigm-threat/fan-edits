# Seeding fan-edit video on IPFS (Flashback Repository)

Flashback Repository ([flashbackrepository.org](https://flashbackrepository.org/)) is a **thin IPFS** Relay catalog repo: Git holds CleverScript, metadata, and **text pointer stubs** under `.relay/assets/`. The actual `.mkv` files live on IPFS and are pinned by whoever seeds them (your workstation and/or the Relay fleet).

**Playback is same-origin only.** The browser requests `/FanMixes/…/….mkv` on this site. Relay resolves the CID, pins it into the **node’s local Kubo**, and serves bytes (Range) from that Kubo. The browser does **not** talk to `ipfs.io` / Helia / public gateways for video.

See also: [docs/RELAY_DESKTOP.md](docs/RELAY_DESKTOP.md), [docs/PARKED_THIN_VIDEO.md](docs/PARKED_THIN_VIDEO.md), and **`relay-gateway/docs/RELAY_IPFS.md`** in your relay-gateway checkout (Kubo install, gateway env, status JSON).

## Fleet fetch limits (movie exception)

For multi‑GB fan-edits, gateway defaults are raised:

| Env | Default (thin-video) |
|-----|----------------------|
| `RELAY_IPFS_MAX_FETCH_BYTES` | **8 GiB** |
| `RELAY_IPFS_MAX_RANGE_BYTES` | **64 MiB** (per Range response) |
| `RELAY_IPFS_CACHE_MAX_BYTES` | **200 GiB** |

Prefer **Kubo pin + Range** over stuffing every mkv into the relay file cache.

## Prerequisites

1. **Kubo** — `ipfs` CLI installed; **`ipfs daemon`** running (HTTP API on **`:5001`** by default). Ingest and pre-commit pin checks fail without it. On this workstation the repo lives on the **local HDD** (`/media/ari/HD/ipfs-kubo`, symlinked from `~/.ipfs`) so multi‑GB pins do not fill the NVMe root.

   **Boot (this machine):** user unit `~/.config/systemd/user/ipfs.service` is **enabled** with **linger** so Kubo starts at boot (after `/media/ari/HD` mounts), not only when you open a terminal:

   ```bash
   systemctl --user status ipfs
   systemctl --user restart ipfs   # only if you need a clean restart
   ```

   **Web UI:** open [http://127.0.0.1:5001/webui](http://127.0.0.1:5001/webui) in a browser on this computer (API is bound to localhost only).
2. **`relay-ipfs-ingest`** — from a **relay-gateway** checkout, typically:
   `~/dev/relay/relay-gateway/scripts/relay-ipfs-ingest`
   (must be on `PATH` or invoked by full path; `scripts/ingest-fanedit-renders.py` hardcodes this path).
3. Optional: install repo hooks so staged binaries are ingested before commit:
   `relay-ipfs-ingest --install-hooks`

## Source renders (local disk)

Final encodes are kept **outside Git** on NAS/local disk. The bulk helper expects:

| Path | Role |
|------|------|
| `/media/ari/HD/FanEditRender/<ProjectFolder>/` | One folder per fan-edit; name must **exactly match** the repo folder under `FanMixes/` or `KidFriendly/` (no fuzzy matching). |
| `FanMixes/<ProjectFolder>/` or `KidFriendly/...` | Kdenlive project tree; ingest symlinks the chosen `.mkv` here (gitignored). |

There is **no environment variable** for the render root today — change `RENDER` at the top of `scripts/ingest-fanedit-renders.py` if your mount differs.

## Run bulk ingest

From the repo root, with Kubo up:

```bash
ipfs daemon   # separate terminal if not already running
python3 scripts/ingest-fanedit-renders.py
```

For each matched title the script:

1. Symlinks the best-scoring `.mkv` from `FanEditRender/<ProjectFolder>/` into the project folder (skips previews, seams, and obvious source rips).
2. Runs `relay-ipfs-ingest <logical-path>` (e.g. `FanMixes/Sonic (2020) - DeSchwartzed/Sonic (2020) - DeSchwartzed Edition.mkv`).

`relay-ipfs-ingest` **`ipfs add --pin`**, writes **`.relay/assets/<logical-path>.ipfs`**, updates **`assets.manifest.json`**, and **`git add`s** those files. It does **not** create a Git commit.

**Single asset** (same as the script, by hand):

```bash
cd ~/dev/fan-edits
~/dev/relay/relay-gateway/scripts/relay-ipfs-ingest 'FanMixes/…/….mkv'
```

Useful flags (see `relay-ipfs-ingest --help`): **`--dry-run`**, **`--ingest-staged`**, **`--check-staged`**.

Pointer stub format (committed to Git):

```text
relay-ipfs-v1
bafybei…
video/x-matroska
sha256=…
```

After ingest, refresh the library catalog if READMEs changed, then **rebuild the media-root DAG**:

```bash
python3 scripts/generate-index-json.py
python3 scripts/build-ipfs-media-root.py   # writes mediaRoot + IPFS_ROOT
git add index.json assets.manifest.json IPFS_ROOT .relay/assets/
git commit -m "catalog: ingest fan-edit renders to IPFS"
```

`scripts/ingest-fanedit-renders.py` runs `build-ipfs-media-root.py` at the end (with `--skip-missing` if some titles failed). Before publish, re-run **without** `--skip-missing` so every manifest CID is in the root.

Pre-commit (with hooks installed) rejects commits if a referenced CID is **not pinned locally**.

## Media-root DAG (clone + one sync)

Per-file CIDs stay in `.relay/assets/**/*.ipfs` and `assets.manifest.json` `assets[]` (what the gateway player resolves). After a successful build, the manifest also has:

```json
{
  "schema": "relay.assets-manifest.v1",
  "mediaRoot": "bafy…",
  "mediaRootBuiltAt": "2026-10-05T…",
  "assets": [ … ]
}
```

The same CID is written to tip file **`IPFS_ROOT`**. That CID is a **UnixFS directory** whose paths mirror logical media paths only (`FanMixes/…`, favicons, `og-image.png`, …) — not CleverScript or Git history.

### Full library sync after clone

```bash
git clone … fan-edits && cd fan-edits
ROOT=$(jq -r .mediaRoot assets.manifest.json)   # or: ROOT=$(cat IPFS_ROOT)
ipfs get -o .ipfs-media "$ROOT"
rsync -a .ipfs-media/ ./
```

Leaf file CIDs are stable when you only add/replace assets; only directory nodes (and thus `mediaRoot`) change when the path→CID set changes.

Rebuild anytime:

```bash
python3 scripts/build-ipfs-media-root.py
# flags: --dry-run  --skip-pin  --skip-git  --skip-missing
```

### Local pinning and seeding

Ingest already pins via `ipfs add --pin`. To (re)pin or verify:

```bash
CID=bafybei…   # from stub line 2 or assets.manifest.json "ipfs"
ipfs pin add "/ipfs/$CID"
ipfs block stat "/ipfs/$CID"
ipfs pin ls --type=recursive -q | grep -F "$CID"
```

To confirm bytes, not just the pin record:

```bash
ipfs cat "/ipfs/$CID" | head -c 16 | xxd
```

Keep **`ipfs daemon`** running while you want this machine to **provide** blocks to the network (swarm **TCP/UDP 4001** must be reachable if remote peers should pull from you). Git metadata on Relay does **not** copy the video; without at least one pinned provider, playback stays blocked.

## Publish stubs to the live Relay mesh

Commits should contain **stubs + manifest only** (no `.mkv` in Git). Publish **metadata** to the fleet **before** GitLab backup:

```bash
git push iad1 main    # git://iad1.relaygateway.net:9418/fan-edits.git
git push gitlab main  # forge backup; not the IPFS seed path
```

Configure mesh remotes once from **relay-gateway**:

```bash
cd ~/dev/relay/relay-gateway
./scripts/relay-local-remotes.sh --probe   # or --all
```

Catalog **`publish_origin`** for this site is **`iad1.relaygateway.net`** ([docs/PARKED_THIN_VIDEO.md](docs/PARKED_THIN_VIDEO.md)). Details: **`relay-gateway/docs/RELAY_PUBLISH_ONCE.md`**.

**Offline transport:** if you cannot push directly to `iad1`, use normal Git **`git bundle`** to carry commit(s) to a host that can `git push iad1 main`. That moves **pointer commits only**; you still must seed the CIDs on IPFS separately.

**Bare hook overlays** (operators, rare): relay-gateway dev tooling applies hook changes with **`git commit-tree`** on a bare repo without rewriting your checkout branch — see **`relay-gateway/scripts/docker-ipfs-dev-prepare.sh`** and **`relay-gateway/docs/DOCKER_IPFS_DEV.md`**. Not required for day-to-day stub publishes.

## Fleet pinning

Production nodes run Kubo plus **`relay-ipfs-pin-catalog`** (systemd timer **`relay-ipfs-pin-catalog.timer`**) to pin CIDs referenced from thin repos’ **`.relay/assets/**/*.ipfs`** and **`assets.manifest.json`**. That is **IPFS seeding**, not `git ensure-bare`.

**Preferred:** recursively pin the tip’s **`mediaRoot`** (one pin pulls the whole UnixFS tree of media leaves):

```bash
ROOT=$(jq -r .mediaRoot /path/to/fan-edits/assets.manifest.json)
ipfs pin add --recursive "/ipfs/$ROOT"
```

**Fallback:** pin-catalog still walks per-file stubs / `assets[]` entries until fleet tooling pins `mediaRoot` automatically. Either way, operators can verify with `ipfs pin ls` and `?relayAssetStatus=1` on a logical path.

On a fleet host (paths from install):

```bash
RELAY_REPO_PATH=/opt/relay/data IPFS_PATH=/opt/relay/ipfs \
  /opt/relay/bin/relay-ipfs-pin-catalog [--dry-run]
```

See **`relay-gateway/docs/RELAY_IPFS.md`** (Fleet Kubo section).

## Verify playback and seed status

### Status probe (`relayAssetStatus=1`)

Append **`?relayAssetStatus=1`** to the **logical media URL** (or send `Accept: application/vnd.relay.asset-status+json`). The site player (`hooks/client/components/RelayMedia.jsx`) polls this before starting video.

| What you see | JSON `message` (typical) | Meaning |
|--------------|--------------------------|---------|
| Player **Ready** / video starts | **`asset available`**, `"error": "ok"`, `seed.state`: **`cached`** | Gateway (or cache) has bytes; playback should work. |
| **This file needs to be seeded** | **`This file needs to be seeded`**, errors like **`ipfs-not-found`**, **`ipfs-pending`** | CID is in Git; **no provider** (or not on this gateway yet). Pin/seed locally or wait for fleet pin + fetch. |
| **Seeding…** / progress bar | `seed.state`: **`fetching`** | Gateway is pulling the CID (retryable). |

Example (replace path and host with your title):

```bash
curl -sS 'https://flashbackrepository.org/FanMixes/Sonic%20(2020)%20-%20DeSchwartzed/Sonic%20(2020)%20-%20DeSchwartzed%20Edition.mkv?relayAssetStatus=1' \
  -H 'Accept: application/vnd.relay.asset-status+json' | jq .
```

Per-CID probe on a Relay node:

```bash
curl -sS 'https://iad1.relaygateway.net/ipfs/bafybei…?relayAssetStatus=1' | jq .
```

### Local vs gateway bytes

| Check | Command |
|-------|---------|
| Local Kubo has block | `ipfs block stat /ipfs/$CID` |
| Local Kubo can read | `ipfs cat /ipfs/$CID \| wc -c` (compare to `bytes` in `assets.manifest.json`) |
| Loopback gateway (fleet/dev) | `curl -I "http://127.0.0.1:8081/ipfs/$CID"` |
| Public site path | Same URL as the player `src` with `?relayAssetStatus=1` |

**`GET /api/status`** on a fleet FQDN (schema ≥ 3) includes **`ipfs_ok`** and per-repo IPFS cache counts when Kubo is healthy — see RELAY_IPFS.md.

## Troubleshooting

- **`missing … relay-ipfs-ingest`** — build/checkout relay-gateway; fix `INGEST` in `scripts/ingest-fanedit-renders.py`.
- **`NO CAND` / `SKIP` in ingest script** — no matching folder under `FanEditRender`, or filename scored too low; fix folder name or pick the `.mkv` manually and run `relay-ipfs-ingest` on that logical path.
- **`CID not pinned locally`** — start `ipfs daemon` and re-run ingest, or `ipfs pin add`.
- Site shows seed message after push — pointers reached Relay, but **IPFS bytes** are not pinned anywhere reachable; pin on your machine and/or confirm fleet **`relay-ipfs-pin-catalog`** ran for `fan-edits` (or recursively pin **`mediaRoot`**).
- **`build-ipfs-media-root.py` exits with missing CIDs** — some manifest entries are not in local Kubo; finish ingest/pin, or use `--skip-missing` only for a temporary partial root (re-run full build before publish).
