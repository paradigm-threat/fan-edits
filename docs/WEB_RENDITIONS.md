# Published finals: HEVC MKV (external player)

**One file per title:** the finished edit as **HEVC Matroska** (`.mkv`) with **embedded subtitles**.  
Theater default is **stream in an external player** (copy HTTPS URL → VLC Open Network Stream), not in-browser `<video>`.

| Artifact | Suffix | Status |
|----------|--------|--------|
| Archival + theater master | `*.mkv` (HEVC, embedded subs) | **Required** |
| HEVC MP4 remux | `*.hevc.mp4` | **Not required** for ship |
| H.264 ladders | `*.web-1080p.mp4` / `*.mobile-720p.mp4` | **Not required** — cancelled |

Do **not** batch-encode H.264 web/mobile for publish. Optional later R&D may revisit in-page play; it is not the Halloween path.

Sidecar `subs/` (VTT/SRT) may still exist for tooling; the MKV remains the watchable master with muxed tracks.

## Paths / status

| Path | Role |
|------|------|
| `/media/ari/HD/FanEditRender/<Project>/` | Final `*.mkv` (+ optional `subs/`) |
| `SOURCE_RENDER_CONTINUE.md` | Other-machine handoff |
| `WEB_REENCODE_STATUS.md` | H.264 — **cancelled** |
| `HEVC_REMUX_STATUS.md` | MP4 remux — **not required** for ship |

After render: ingest the MKV stub, `generate-index-json.py`, publish tip. Pin only **Now Showing** titles on the gateway.

Scripts `encode-web-renditions.py` / `remux-hevc-stream.py` remain in-tree for experiments only.
