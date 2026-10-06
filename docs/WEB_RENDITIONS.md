# Web / mobile H.264 re-encode (distributed)

Archival masters stay full-res **Matroska/HEVC** on disk/IPFS. **`mediaWeb` / `mediaMobile`** are H.264 MP4 **compatibility-only** (old browsers, failed native/WASM probes, sustained underrun). There is **no max-res MP4**.

| Rung | Suffix | Who gets it |
|------|--------|-------------|
| Highest | master (archival) | Tried first: native HTML5 when possible, else `relay-video-wasm` → WebCodecs |
| Browser fallback | `*.web-1080p.mp4` | Compatibility after master fail; preferred MP4 on wide viewports |
| Mobile fallback | `*.mobile-720p.mp4` | Compatibility on narrow / Save-Data |

When full-quality decode is unavailable, the theater host switches to 1080p/720p with copy like: *Full quality needs a capable browser — switching to 1080p for compatibility.*

## Do not encode the whole library on one workstation

Encodes are multi-hour per title. Work is shared via the NAS HDD:

| Path | Role |
|------|------|
| `/media/ari/HD/dev/fan-edits` | Synced git working tree (scripts + catalog + stubs; no multi‑GB masters) |
| `/media/ari/HD/FanEditRender/<ProjectFolder>/` | Masters + write `*.web-1080p.mp4` / `*.mobile-720p.mp4` here (or symlink into repo `FanMixes/…`) |
| `/media/ari/HD/FanEditRender/WEB_REENCODE_STATUS.md` | Claim / done checklist for other machines |

## Sync this repo onto the NAS (from the machine that has the tip)

```bash
cd ~/dev/fan-edits
mkdir -p /media/ari/HD/dev
rsync -a --delete \
  --exclude '.git/objects/pack/*.tmp' \
  --exclude 'node_modules' \
  --exclude 'test-results' \
  --exclude '*.mkv' \
  --exclude '*.web-1080p.mp4' \
  --exclude '*.mobile-720p.mp4' \
  --exclude 'seam-*.mp4' \
  ./ /media/ari/HD/dev/fan-edits/
```

Other computers: open `/media/ari/HD/dev/fan-edits` (or rsync it home), ensure Kubo + ffmpeg, then encode claimed titles.

## Per-machine encode + ingest

```bash
# 1. Claim a title in WEB_REENCODE_STATUS.md (see FanEditRender copy)

# 2. Encode beside the master (outputs land next to the .mkv you point at)
cd /media/ari/HD/dev/fan-edits   # or your synced checkout
python3 scripts/encode-web-renditions.py \
  "/media/ari/HD/FanEditRender/<ProjectFolder>" \
  --preset medium

# Or from a repo FanMixes symlink folder:
python3 scripts/encode-web-renditions.py "FanMixes/<ProjectFolder>"

# 3. Copy/symlink MP4s into the repo project folder if encoded under FanEditRender
# 4. Ingest thin stubs (this machine needs ipfs daemon)
python3 scripts/ingest-fanedit-renders.py --web-renditions-only
python3 scripts/generate-index-json.py
python3 scripts/build-ipfs-media-root.py

# 5. Mark done in WEB_REENCODE_STATUS.md; commit stubs + index + manifest; push iad1
```

Flags: `--which web|mobile|all`, `--force`, `--dry-run`, `--preset veryfast` (pilots only).

## Subtitles

```bash
python3 scripts/srt_to_vtt.py
```

VTT is git text; TheaterPlayer uses native `<track>` + CC button.

## Status file

Canonical checklist on the NAS: [`/media/ari/HD/FanEditRender/WEB_REENCODE_STATUS.md`](/media/ari/HD/FanEditRender/WEB_REENCODE_STATUS.md)  
(mirrored under `docs/WEB_REENCODE_STATUS.template.md` in git for bootstrapping).
