# Parked thin-video checklist (Flashback Repository)

Reference implementation: **fan-edits** → domains `flashbackrepository.org`.

1. Catalog `catalog/repos/<repo>.json`: `tier: primary`, `publish_origin: iad1.relaygateway.net`, `limits.thin_ipfs_assets: true`, `limits.fleet_pin_ipfs: false`, `domains[]`
2. Repo `.relay.yaml`: `server.tls.plugin: park`, `canonical`
3. `hooks/server/get.cs`: SSR shell (`ssrClientHookFromGetContext`) **before** IPFS resolve; `sources: ["centralDir", "manifest"]`
4. `assets.manifest.json` with **`assets: []`** (array) + `.relay/assets/**/*.ipfs` stubs (no binaries in Git); after ingest run **`scripts/build-ipfs-media-root.py`** so tip has **`mediaRoot`** + **`IPFS_ROOT`**
5. Ingest + **local** pin: `relay-ipfs-ingest <logical-path>` with workstation Kubo up. **Do not** fleet-pin or cache multi‑GB masters on Relay nodes (retired). Catalog CIDs are for APK / browser direct IPFS download.
5b. **Now showing** = manually uploaded host files for the carousel — separate from the IPFS catalog.
6. Client: ownership gate + per-title ack; seed UX — missing CID copy is **“This file needs to be seeded”** (no fleet provider expected)
7. DNS: apex ALIAS + `www` CNAME → `fleet.relaygateway.net`
8. Publish: `git push iad1 main` first, then GitLab (stubs only)
