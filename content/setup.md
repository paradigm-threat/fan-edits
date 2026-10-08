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

### Phone / tablet (Android)

No computer installer. Install [VLC for Android](https://play.google.com/store/apps/details?id=org.videolan.vlc), open a title on Flashback, confirm ownership, tap **Open in external player**, and pick VLC.

---

## Step 3 — Watch a title

1. Open a film on Flashback.
2. Confirm you own a legal copy of the original (once per title on this browser).
3. Tap **Open in VLC**.

If the button does nothing, use **Copy stream URL**, then in VLC: **Media → Open Network Stream… → paste → Play**.

---

## If something goes wrong

| What you see | What to do |
| --- | --- |
| Mac asks which app | Choose **Flashback VLC Protocol** |
| “VLC not found” | Install VLC, then run the Step 2 command again |
| Button does nothing | Use **Copy stream URL** → VLC → Open Network Stream |
| Android chooser missing | Copy stream URL → VLC → Network → paste |

Uninstall (optional): [macOS / Linux helpers](/scripts/vlc-protocol/install-macos.sh) live under `/scripts/vlc-protocol/` — see `uninstall-linux.sh` / `uninstall-windows.ps1` in that folder.

---

## Advanced (editors only)

Clone the **project catalog** (Kdenlive projects, subtitles, READMEs — not the big movie files):

```bash
git clone git://iad1.relaygateway.net:9418/fan-edits.git
```

Fallbacks: `ord1` / `hkg1` on the same port, or GitLab (`git@gitlab.com:clevertree/fan-edits.git`). Feature `.mkv` files stay on IPFS and stream after ownership confirm — see [Ownership](/legal) and [Submit](/submit).

Optional browser extension (does **not** replace Step 2): [Open in VLC](https://chromewebstore.google.com/detail/open-in-vlc-media-player/ihpiinojhnfhpdmmacgmpoonphhimkaj).
