# Seeding fan-edit video on IPFS (Flashback Repository)

Flashback Repository ([flashbackrepository.org](https://flashbackrepository.org/)) is a **thin IPFS** Relay catalog repo: Git holds CleverScript, metadata, and **text pointer stubs** under `.relay/assets/`. The actual `.mkv` files live on IPFS and are pinned by whoever seeds them (your workstation and/or the Relay fleet).

See also: [docs/RELAY_DESKTOP.md](docs/RELAY_DESKTOP.md), [docs/PARKED_THIN_VIDEO.md](docs/PARKED_THIN_VIDEO.md), and **`relay-gateway/docs/RELAY_IPFS.md`** in your relay-gateway checkout (Kubo install, gateway env, status JSON).

## Prerequisites

1. **Kubo** — `ipfs` CLI installed; **`ipfs daemon`** running (HTTP API on **`:5001`** by default). Ingest and pre-commit pin checks fail without it.
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

After ingest, refresh the library catalog if READMEs changed:

```bash
python3 scripts/generate-index-json.py
git add index.json assets.manifest.json .relay/assets/
git commit -m "catalog: ingest fan-edit renders to IPFS"
```

Pre-commit (with hooks installed) rejects commits if a referenced CID is **not pinned locally**.

## Local pinning and seeding

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
- Site shows seed message after push — pointers reached Relay, but **IPFS bytes** are not pinned anywhere reachable; pin on your machine and/or confirm fleet **`relay-ipfs-pin-catalog`** ran for `fan-edits`.
