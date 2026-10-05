# fan-edits — Relay desktop client

Open this repo in the native Relay desktop shell (library UI + per-project README pages).

## Prerequisites

- Built **relay-gateway** and **relay-client-desktop** (see [clevertree/relay-client-desktop](https://gitlab.com/clevertree/relay-client-desktop))
- This checkout is a **git repo** with committed `hooks/`, `.relay.yaml`, and `index.json`
- Optional: **Kubo** (`ipfs` CLI) for thin-repo media via `--ipfs`

## Quick start

```bash
# From relay workspace (sibling relay-gateway checkout):
cd ~/dev/relay/relay-gateway && cargo build --bin relay-gateway
cd ~/dev/relay && cargo build -p relay-client-desktop

# Regenerate catalog after adding READMEs:
python3 ~/dev/fan-edits/scripts/generate-index-json.py
git add index.json && git commit -m "catalog: refresh index.json"

# Open library (commits HEAD → ~/.relay/desktop-repos mirror):
~/dev/relay/target/debug/relay-client-desktop --repo ~/dev/fan-edits

# With local Kubo for IPFS-backed assets:
relay-client-desktop --repo ~/dev/fan-edits --ipfs
```

Headless smoke:

```bash
./scripts/open-relay-desktop.sh --verify
# or:
relay-client-desktop --verify --repo ~/dev/fan-edits --manifest ~/dev/fan-edits/render-manifest.json
```

## Media layout (thin IPFS)

- **In git:** `hooks/`, `index.json`, `.relay.yaml`, `.relay/assets/*.ipfs` stubs, `assets.manifest.json`
- **Gitignored:** source `.mkv`/`.mp4`, project working files under `FanMixes/` and `KidFriendly/`
- **Desktop:** reads text from checkout overlay first; binaries resolve via gateway `server.hooks.get` + IPFS

Ingest workflow: `relay-gateway/scripts/relay-ipfs-ingest` (see `relay-gateway/docs/RELAY_IPFS.md`).

## NAS / GitLab sync

- **GitLab** is source of truth for hooks and metadata (`git push gitlab main`)
- **NAS / local rips** stay gitignored; never commit media binaries
- After pull on another machine: `git pull` then open with `--repo` (mirror syncs committed HEAD)
