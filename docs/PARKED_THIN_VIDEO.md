# Parked thin-video checklist (Flashback Repository)

Reference implementation: **fan-edits** → domains `flashbackrepository.org`.

1. Catalog `catalog/repos/<repo>.json`: `tier: primary`, `publish_origin: iad1.relaygateway.net`, `limits.thin_ipfs_assets: true`, `domains[]`
2. Repo `.relay.yaml`: `server.tls.plugin: park`, `canonical`
3. `hooks/server/get.cs`: SSR shell (`ssrClientHookFromGetContext`) **before** IPFS resolve; `sources: ["centralDir", "manifest"]`
4. `assets.manifest.json` with **`assets: []`** (array) + `.relay/assets/**/*.ipfs` stubs (no binaries in Git)
5. Ingest: `relay-ipfs-ingest <logical-path>` with Kubo up; fleet pin via `relay-ipfs-pin-catalog`
6. Client: ownership gate + per-title ack; `RelayMedia` seed UX — missing CID copy is **“This file needs to be seeded”**
7. DNS: apex ALIAS + `www` CNAME → `fleet.relaygateway.net`
8. Publish: `git push iad1 main` first, then GitLab
