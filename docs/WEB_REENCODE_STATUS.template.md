# H.264 web/mobile status — **CANCELLED** (copy to NAS)

Canonical live file:

`/media/ari/HD/FanEditRender/WEB_REENCODE_STATUS.md`

**Do not encode** `*.web-1080p.mp4` / `*.mobile-720p.mp4`. Publish is HEVC remux only (`HEVC_REMUX_STATUS.md`).

Kill in-flight H.264 jobs on every machine. Leftover finished H.264 files may remain on disk; do not finish partials.

| Project folder | web-1080p | mobile-720p | Notes |
|----------------|-----------|-------------|-------|
| Boogie Nights (1997) - No Lookout | leftover | — | Remux done |
| Van Helsing - DeAnna'd | leftover | killed | Remux next |
| *(all others)* | cancelled | cancelled | Remux only |
