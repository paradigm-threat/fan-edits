# Parked thin-video checklist (Flashback Repository)

Reference implementation: **fan-edits** → domains `flashbackrepository.org`.

1. Catalog `catalog/repos/<repo>.json`: `tier: primary`, `publish_origin: iad1.relaygateway.net`, `limits.thin_ipfs_assets: true`, `limits.fleet_pin_ipfs: false`, `limits.max_ipfs_bytes: 0`, `domains[]`
2. Repo `.relay.yaml`: `server.tls.plugin: park`, `canonical`
3. `hooks/server/get.cs`: SSR shell (`ssrClientHookFromGetContext`) **before** IPFS resolve; `sources: ["centralDir", "manifest"]`
4. `assets.manifest.json` + `.relay/assets/**/*.ipfs` stubs for **masters only** (no movie binaries in Git). **Posters** are git tip binaries (`FanMixes/…/poster.jpg`) — not IPFS stubs. After master ingest run **`scripts/build-ipfs-media-root.py`** so tip has **`mediaRoot`** + **`IPFS_ROOT`**.
5. Ingest + **local** pin masters: `relay-ipfs-ingest <logical-path>` with workstation Kubo up. Fleet must not pin/sync/cache fan-edits IPFS bytes (gateway honors catalog limits; ops: `RELAY_IPFS_SKIP_PIN_REPOS=fan-edits`, wipe `{RELAY_IPFS_CACHE_ROOT}/fan-edits`).
5b. **Now showing** = manually uploaded host files for the carousel — separate from the IPFS catalog. Poster `<img>` URLs stay tip/git paths.
6. Client: ownership gate + per-title ack; seed UX — missing CID copy is **“This file needs to be seeded”** (no fleet provider expected)
7. DNS: apex ALIAS + `www` CNAME → `fleet.relaygateway.net`
8. Publish: `git push iad1 main` first, then GitLab (stubs only)
