# Setup for playback

Flashback plays **full-quality movie files** in [VLC](https://www.videolan.org/vlc/) (browsers cannot play them in the page). One short setup on your computer makes the **Open in VLC** button work.

You only need to do this **once per computer**.

---

## Step 1 — Install VLC

Download and install VLC from the official site: **[videolan.org/vlc](https://www.videolan.org/vlc/)**.

Open VLC once so macOS / Windows finishes any first-run prompts.

---

## Step 2 — Enable one-click Open in VLC

### Mac

1. Open **Terminal** (press `Cmd + Space`, type `Terminal`, press Return).
2. Copy the line below, paste it into Terminal, press Return:

```bash
curl -fsSL https://flashbackrepository.org/scripts/vlc-protocol/install-macos-online.sh | bash
```

3. When you first use **Open in VLC** on the site, if your Mac asks which app should open the link, choose **Flashback VLC Protocol** and allow it to remember that choice.

That is the whole Mac setup. No test video, no extra downloads.

Direct download of the same installer (advanced): [install-macos-online.sh](/scripts/vlc-protocol/install-macos-online.sh)

### Windows

1. Install VLC (Step 1).
2. Open **PowerShell**.
3. Paste this line and press Enter:

```powershell
irm https://flashbackrepository.org/scripts/vlc-protocol/install-windows.ps1 | iex
```

### Linux

1. Install VLC (e.g. `sudo apt install vlc`).
2. In a terminal:

```bash
curl -fsSL https://flashbackrepository.org/scripts/vlc-protocol/install-linux-online.sh | bash
```

### Phone / tablet / Android TV — Flashback app (recommended)

Browsers cannot play our full-quality HEVC MKV files. Install the sideloaded **Flashback Repository** app instead — versioned APKs, Fire TV notes, Play Protect steps, and iOS limits are all on **[Flashback App](/app)**.

iPhone / iPad: there is no sideload app; use this Setup page + VLC in the browser.

---

## Step 3 — Watch a title (computer browser)

1. Open a film on Flashback.
2. Confirm you own a legal copy of the original (once per title on this browser).
3. Tap **Open in VLC**.

If the button does nothing, use **Copy stream URL**, then in VLC: **Media → Open Network Stream… → paste → Play**.

---

## Open catalog titles over IPFS

**Now showing** titles use Bunny CDN (Steps 1–3 above). The rest of the library is addressed by **content hash** on the IPFS network — title pages show a clickable `ipfs://…` link, not a download from this site’s servers.

You need a client that understands `ipfs://` (or the Flashback App). Bytes are available only while a peer is seeding that CID.

### Flashback App (recommended on Android / Fire TV)

Install the sideloaded **Flashback Repository** app — it runs an embedded IPFS node (Bitswap) and can play or keep titles offline. See **[Flashback App](/app)**.

### Browser extensions

- **[IPFS Companion](https://github.com/ipfs/ipfs-companion)** — official extension for **Chrome / Chromium** and **Firefox**. Detects `ipfs://` links, routes them to your local or public gateway, and helps you download.
- **Pinata extension** (optional) — if you already use Pinata’s pinning service, their toolbar extension can help manage and fetch IPFS content.

### Desktop and CLI

- **[IPFS Desktop](https://docs.ipfs.tech/install/ipfs-desktop/)** — official GUI node for Windows, macOS, and Linux; open or pin files from the app.
- **[Kubo](https://docs.ipfs.tech/install/command-line/)** (Go-IPFS) — CLI daemon; e.g. `ipfs get <cid>` or `ipfs pin add <cid>` after copying the CID from a title page.

### Browsers with built-in `ipfs://` support

- **Brave** — native IPFS settings; can use a local node or a public gateway.
- **Opera** — built-in `ipfs://` support on desktop and mobile.

After you have a client, open a catalog title → confirm ownership → click the **`ipfs://…`** link (or **Copy CID** and paste into Desktop / Kubo). Peers must be online for the file to arrive.

---

## If something goes wrong

| What you see | What to do |
| --- | --- |
| Mac asks which app | Choose **Flashback VLC Protocol** |
| “VLC not found” | Install VLC, then run the Step 2 command again |
| Button does nothing | Use **Copy stream URL** → VLC → Open Network Stream |
| Android install / Play Protect / Fire TV ABI | See **[Flashback App](/app)** |
| Android in-app play fails | Install VLC → **Open in external player** (or a lower quality rung on the title page) |
| Android chooser missing | Install VLC from the Play Store first |

Uninstall (optional): [macOS / Linux helpers](/scripts/vlc-protocol/install-macos.sh) live under `/scripts/vlc-protocol/` — see `uninstall-linux.sh` / `uninstall-windows.ps1` in that folder.

---

## Advanced (editors only)

Clone the **project catalog** (Kdenlive projects, subtitles, READMEs — not the big movie files):

```bash
git clone git://iad1.relaygateway.net:9418/fan-edits.git
```

Fallbacks: `ord1` / `hkg1` on the same port, or GitLab (`git@gitlab.com:clevertree/fan-edits.git`). Feature `.mkv` files stay on IPFS and stream after ownership confirm — see [Ownership](/legal) and [Submit](/submit).

**Media root CID** (whole thin-media DAG): `bafybeid7zmxfovcgpebtalojong2fw5nc7hnle2bxh2g7ihu74sbfigoya` — also in repo `IPFS_ROOT` / `assets.manifest.json` (`mediaRoot`). [Inspect](https://cid.ipfs.tech/#bafybeid7zmxfovcgpebtalojong2fw5nc7hnle2bxh2g7ihu74sbfigoya).

Optional browser extension (does **not** replace Step 2): [Open in VLC](https://chromewebstore.google.com/detail/open-in-vlc-media-player/ihpiinojhnfhpdmmacgmpoonphhimkaj).
