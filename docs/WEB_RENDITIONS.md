# Published finals: HEVC MP4 only

**One file per title:** remux the final edit to `*.hevc.mp4` (`ffmpeg -c copy`).  
**Do not run H.264 web/mobile encodes** for publish.

| Artifact | Suffix | Status |
|----------|--------|--------|
| Archival + theater | `*.hevc.mp4` | **Required** |
| Final Matroska | `*.mkv` | **Remove** after remux |
| H.264 ladders | `*.web-1080p.mp4` / `*.mobile-720p.mp4` | **Not required** — cancelled |

Modern browsers play HEVC MP4 for the most part; rare gaps use **Download** + VLC.

Subtitles: shared `subs/` (default + enhanced), title-aligned — not per-resolution.

## Remux (low CPU)

```bash
python3 scripts/remux-hevc-stream.py \
  "/media/ari/HD/FanEditRender/<ProjectFolder>" \
  --replace-source
```

`--replace-source` deletes the source `.mkv` after a successful remux. Add `--extract-subs` if `subs/` needs english/enhanced tracks.

## Paths / status (NAS)

| Path | Role |
|------|------|
| `/media/ari/HD/dev/fan-edits` | Synced git tree |
| `/media/ari/HD/FanEditRender/<Project>/` | `*.hevc.mp4` + `subs/` |
| `HEVC_REMUX_STATUS.md` | **Active** remux queue |
| `WEB_REENCODE_STATUS.md` | H.264 — **cancelled** |
| `SOURCE_RENDER_CONTINUE.md` | Other-machine handoff |

After remux: ingest `*.hevc.mp4`, `generate-index-json.py`, publish tip.

Scripts `encode-web-renditions.py` / `render-web-from-kdenlive.py` remain in-tree for emergencies only — do not use them for the library rollout.
