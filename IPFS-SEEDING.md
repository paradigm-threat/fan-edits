# Seeding fan-edit video on IPFS (Flashback Repository)

Flashback Repository ([flashbackrepository.org](https://flashbackrepository.org/)) is a **thin IPFS catalog** Relay repo: Git holds CleverScript, metadata, posters, and **text pointer stubs** under `.relay/assets/` for feature masters (usually `.mkv`). The movie bytes live on the **IPFS network**; this repo is the **catalog of seeded CIDs**, not a server-side media cache.

**Roles (retired vs current):**

| Surface | Role |
|---------|------|
| **Git / Relay tip** | Catalog only — stubs, `assets.manifest.json`, `index.json`. No movie binaries. |
| **Workstation Kubo** | Pin/seed masters so APK and browsers can pull them **directly from the IPFS swarm**. |
| **Relay fleet** | Does **not** cache or pin Flashback movie files. Fleet IPFS disk cache for multi‑GB video is **retired**. |
| **Now showing** | Manually uploaded files on the host for the carousel — **not** IPFS-cache “hot titles.” |
| **APK / some browsers** | Fetch catalog CIDs over IPFS (embedded Kubo / Bitswap), not via a Relay movie cache. |

Small-binary IPFS caching (images, APKs elsewhere) is outside this repo; see relay-gateway `RELAY_IPFS.md`.

See also: [docs/RELAY_DESKTOP.md](docs/RELAY_DESKTOP.md), [docs/PARKED_THIN_VIDEO.md](docs/PARKED_THIN_VIDEO.md), and **`relay-gateway/docs/RELAY_IPFS.md`**.

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

## Fleet: no movie cache / no fleet pin (retired)

Flashback **does not** use Relay fleet nodes as IPFS seeders or disk caches for feature video.

- Do **not** run `relay-ipfs-pin-catalog` against `fan-edits` for multi‑GB masters.
- Do **not** expect `/opt/relay/ipfs-cache` to hold MKVs; that path is for small binaries elsewhere, not this catalog.
- Catalog `limits.fleet_pin_ipfs` is **`false`**. Tip-push `spawn_pin_repo_tip` should skip this slug (`RELAY_IPFS_SKIP_PIN_REPOS=fan-edits` / `RELAY_IPFS_FLEET_PIN=0` on fleet).

**Your job as publisher:** pin masters on a workstation (or any durable peer), keep swarm **4001** reachable, publish stubs to `iad1`. Clients (Flashback APK, browsers that speak IPFS) pull CIDs from the network.

Workstation pin helper (this machine):

```bash
cd ~/dev/fan-edits
./scripts/ipfs-pin-catalog-local.sh          # pin missing CIDs locally
./scripts/ipfs-pin-catalog-local.sh --report # audit only
```

Optional recursive pin of the tip **`mediaRoot`** (local seeder only):

```bash
ROOT=$(jq -r .mediaRoot assets.manifest.json)
ipfs pin add --recursive "/ipfs/$ROOT"
```

## Verify seed status (catalog + local peers)

### Status probe (`relayAssetStatus=1`)

Append **`?relayAssetStatus=1`** to a **logical media URL** (or send `Accept: application/vnd.relay.asset-status+json`). Prefer this for debugging pointers — **not** as proof the fleet has bytes.

| What you see | Meaning |
|--------------|---------|
| **`This file needs to be seeded`** / `ipfs-not-found` | CID is in Git; **no reachable provider** (pin on a seeder). |
| Seed / providers present | Some peer (often your workstation or a client) is providing the CID. |

```bash
curl -sS 'https://flashbackrepository.org/FanMixes/Sonic%20(2020)%20-%20DeSchwartzed/Sonic%20(2020)%20-%20DeSchwartzed%20Edition.mkv?relayAssetStatus=1' \
  -H 'Accept: application/vnd.relay.asset-status+json' | jq .
```

### Local seeder checks

| Check | Command |
|-------|---------|
| Local Kubo has block | `ipfs block stat /ipfs/$CID` |
| Local Kubo can read | `ipfs cat /ipfs/$CID \| wc -c` (compare to `bytes` in `assets.manifest.json`) |
| Local gateway | `curl -I "http://127.0.0.1:8080/ipfs/$CID"` (or your Kubo gateway port) |

## Troubleshooting

- **`missing … relay-ipfs-ingest`** — build/checkout relay-gateway; fix `INGEST` in `scripts/ingest-fanedit-renders.py`.
- **`NO CAND` / `SKIP` in ingest script** — no matching folder under `FanEditRender`, or filename scored too low; fix folder name or pick the `.mkv` manually and run `relay-ipfs-ingest` on that logical path.
- **`CID not pinned locally`** — start `ipfs daemon` and re-run ingest, or `ipfs pin add`.
- Clients cannot fetch after push — pointers reached Relay, but **no IPFS provider**; pin on your workstation (fleet will not hold the MKV).
- **`build-ipfs-media-root.py` exits with missing CIDs** — some manifest entries are not in local Kubo; finish ingest/pin, or use `--skip-missing` only for a temporary partial root (re-run full build before publish).
