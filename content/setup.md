# Setup for playback

Flashback streams **full-quality HEVC Matroska (`.mkv`)** files. Browsers still cannot play that combination in-page, so the honest path is an **external player** — usually [VLC](https://www.videolan.org/vlc/).

This page gets your computer ready so a title’s **Open in VLC** button can launch the stream in one click via a `vlc://` link. It also explains how to **clone the project catalog** from a Relay server when you want Kdenlive projects, subtitles, and other git files locally.

## 1. Install VLC

Download the official build for your OS: [videolan.org/vlc](https://www.videolan.org/vlc/).

Confirm it runs. You do **not** need extra codecs for our streams.

## 2. Pick one way to hand the stream to VLC

Browsers will not open VLC by themselves. Choose **A** (works with Flashback’s **Open in VLC** button on every OS) or **B** (Chrome / Edge / Firefox extension).

### A. Register the `vlc://` URL scheme (recommended)

A tiny **protocol handler** on your machine maps `vlc://…` → open VLC with the HTTPS stream URL. Flashback’s **Open in VLC** button uses this.

We ship per-OS installers in this repo (HTTPS-only; no shell injection of arbitrary URLs).

### Linux

```bash
# from a clone of this repo, or download the two files below into one folder
chmod +x scripts/vlc-protocol/install-linux.sh scripts/vlc-protocol/flashback-vlc-open
./scripts/vlc-protocol/install-linux.sh
```

Or download and run:

- [/scripts/vlc-protocol/flashback-vlc-open](/scripts/vlc-protocol/flashback-vlc-open)
- [/scripts/vlc-protocol/install-linux.sh](/scripts/vlc-protocol/install-linux.sh)

Test:

```bash
xdg-open 'vlc://https://www.videolan.org/vlc/video/dummy.mp4'
```

Uninstall: [/scripts/vlc-protocol/uninstall-linux.sh](/scripts/vlc-protocol/uninstall-linux.sh)

### macOS

```bash
chmod +x scripts/vlc-protocol/install-macos.sh scripts/vlc-protocol/flashback-vlc-open
./scripts/vlc-protocol/install-macos.sh
```

That installs `~/Applications/Flashback VLC Protocol.app` and registers `vlc://`. If the browser asks which app should open the link, choose **Flashback VLC Protocol**.

Test:

```bash
open 'vlc://https://www.videolan.org/vlc/video/dummy.mp4'
```

### Windows

1. Install VLC (default path is fine).
2. Download [/scripts/vlc-protocol/install-windows.ps1](/scripts/vlc-protocol/install-windows.ps1).
3. In PowerShell (current user is enough — no admin):

```powershell
powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
```

Test:

```powershell
start vlc://https://www.videolan.org/vlc/video/dummy.mp4
```

Uninstall: [/scripts/vlc-protocol/uninstall-windows.ps1](/scripts/vlc-protocol/uninstall-windows.ps1)

### B. Chrome / Edge / Firefox extension (optional)

[**Open in VLC™ media player**](https://chromewebstore.google.com/detail/open-in-vlc-media-player/ihpiinojhnfhpdmmacgmpoonphhimkaj) (also on [Firefox](https://addons.mozilla.org/en-US/firefox/addon/open-in-vlc/) / [Edge](https://microsoftedge.microsoft.com/addons/detail/open-in-vlc%E2%84%A2-media-player/hjfcjapkfahlmlefeddpnnlc)) sends media URLs from the browser to VLC.

**Also required:** their small **native client** (the extension prompts you the first time — it bridges the browser to VLC; browsers block that without a helper).

How to use it on Flashback:

1. Install the extension + native client; keep VLC installed.
2. Open a title, confirm ownership, wait for the **stream URL** to show.
3. Either:
   - Right‑click the stream URL (or **Copy stream URL**) and use the extension’s **Open in VLC** context menu / toolbar button, or
   - Paste the HTTPS URL if the extension asks for a link.

**Caveats:** third‑party extension + Node-based native host (trust / update surface). It does **not** power our one-click **Open in VLC** button — that still needs path **A** (`vlc://`). Fine to use both; path **A** is enough alone.

## 3. How the link works

Title pages expose an HTTPS stream, for example:

`https://flashbackrepository.org/FanMixes/Van%20Helsing%20-%20DeAnna'd/Van%20Helsing%20-%20DeAnna'd.mkv`

**Open in VLC** uses a custom scheme (spaces and punctuation encoded safely):

`vlc://weblink?url=https%3A%2F%2Fflashbackrepository.org%2F…`

Your handler strips the `vlc://` wrapper, checks that the inner URL is `http`/`https`, and starts VLC with that stream (Range-friendly network open).

If the one-click button fails (browser blocked the scheme, handler not installed), use **Copy stream URL** and in VLC: **Media → Open Network Stream… → paste → Play**.

## 4. Ownership gate

Same house rule as always: confirm you own a legal commercial copy of the original film before you stream an edit. The site asks once per title on this browser. Feature files are on IPFS (not in public git); see [Ownership policy](/legal).

## Clone the catalog from a Relay server {#clone-repo}

The public site is a **thin git tip**: CleverScript, READMEs, Kdenlive projects, subtitles, posters, and other small files. **Feature `.mkv` masters are not in git** — they sync over IPFS and stream from the servers after you confirm ownership.

To work on cuts locally (open `.kdenlive` in Kdenlive, edit `.srt` tracks, fix typos in a README), clone the same tip the fleet serves:

### Option A — anonymous git protocol (Relay origin)

Any of these peers should work; `iad1` is the usual publish origin:

```bash
git clone git://iad1.relaygateway.net:9418/fan-edits.git
cd fan-edits
```

Fallbacks if one host is down:

```bash
git clone git://ord1.relaygateway.net:9418/fan-edits.git
# or
git clone git://hkg1.relaygateway.net:9418/fan-edits.git
```

You get the catalog tree (`FanMixes/…`, `KidFriendly/…`, `hooks/`, `content/`, `scripts/`, …). Open a title folder and look for `.kdenlive`, `subs/*.srt`, `stats.json`, and the README.

Update later:

```bash
git pull
```

### Option B — GitLab (accounts / merge requests)

For contributions you will push (or open a merge request against), use GitLab:

```bash
git clone git@gitlab.com:clevertree/fan-edits.git
cd fan-edits
```

HTTPS:

```bash
git clone https://gitlab.com/clevertree/fan-edits.git
```

See [Submissions](/submit) for how we prefer Kdenlive projects and MRs. Step-by-step “open a PR / fix a typo” docs will land there next.

### What you will not get from git alone

- The multi‑gigabyte feature `.mkv` files (IPFS / stream unlock on the site)
- Large local rips used only on the editor’s machine

Streaming still uses the title page + VLC (sections above). Cloning is for **editing and packaging**, not a substitute for owning the studio release.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Click does nothing (desktop) | Run the installer again; allow the browser’s “Open VLC / Flashback VLC Protocol?” prompt |
| Click does nothing (Android) | Install VLC from Play Store; allow the app chooser; or Copy stream URL → VLC → Network |
| “VLC not found” | Install VLC, or put `vlc` on your PATH |
| 404 / seed message | That title’s bytes are not pinned on a reachable gateway yet — try later or another Now Showing title |
| Works in VLC via paste but not via `vlc://` | Handler not registered for your user; re-run the OS installer above |
| `git clone git://…` hangs | Try another peer (`ord1` / `hkg1`), or use the GitLab URL above |

## Android phone / tablet browser

You do **not** need the desktop `vlc://` installers. Flashback detects Android browsers and uses an **`intent:`** link so the system app chooser can open the HTTPS stream in VLC (or another player).

1. Install [VLC for Android](https://play.google.com/store/apps/details?id=org.videolan.vlc) from the Play Store.
2. Open a title in Chrome (or another Android browser) → confirm ownership.
3. Tap **Open in external player** → pick **VLC** (or another app that plays network video).
4. If the chooser does not appear: **Copy stream URL** → open VLC → **Network** / **Open network stream** → paste → Play.

The Flashback **Android / TV APK** uses the same intent path inside the app shell.

## Manual fallback (any OS)

1. Open the title on Flashback → confirm ownership.
2. **Copy stream URL**.
3. VLC → **Media → Open Network Stream…** (Android: **Network**) → paste → **Play**.

You can skip the protocol handler entirely and always use this path.
