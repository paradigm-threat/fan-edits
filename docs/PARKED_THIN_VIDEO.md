# Parked thin-video checklist (Flashback Repository)

Reference implementation: **fan-edits** → domains `flashbackrepository.org`.

1. Catalog `catalog/repos/<repo>.json`: `tier: primary`, `publish_origin: iad1.relaygateway.net`, `limits.thin_ipfs_assets: true`, `domains[]`
2. Repo `.relay.yaml`: `server.tls.plugin: park`, `canonical`
3. `hooks/server/get.cs`: SSR shell (`ssrClientHookFromGetContext`) **before** IPFS resolve; `sources: ["centralDir", "manifest"]`
4. `assets.manifest.json` with **`assets: []`** (array) + `.relay/assets/**/*.ipfs` stubs (no binaries in Git); after ingest run **`scripts/build-ipfs-media-root.py`** so tip has **`mediaRoot`** + **`IPFS_ROOT`**
5. Ingest: `relay-ipfs-ingest <logical-path>` with Kubo up; fleet pin via `relay-ipfs-pin-catalog` (prefer recursive pin of **`mediaRoot`**)
5b. Browser ladder: master first (native or WASM escalate) → compat `encode-web-renditions.py` → ingest `*.web-1080p.mp4` + `*.mobile-720p.mp4` → `generate-index-json.py` (`mediaWeb` / `mediaMobile`) → TheaterPlayer falls to 1080p/720p only when full quality cannot play; `srt_to_vtt.py` for native `<track>` CC. Distributed encode: [WEB_RENDITIONS.md](WEB_RENDITIONS.md)
6. Client: ownership gate + per-title ack; TheaterPlayer seed UX — missing CID copy is **“This file needs to be seeded”**; footer shows **mediaRoot** when present
7. DNS: apex ALIAS + `www` CNAME → `fleet.relaygateway.net`
8. Publish: `git push iad1 main` first, then GitLab
