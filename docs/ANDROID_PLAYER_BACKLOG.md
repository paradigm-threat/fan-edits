# Android player — deferred features backlog

Flashback’s APK aims for a **simple watch path**: ownership confirm → stream archival **HEVC Matroska (`.mkv`)** in-app (hardware decode) or **Open in external player** (VLC). This document lists capabilities common in VLC, Nova Player, and similar apps that we are **not implementing now**, so later sessions can pick them up without rediscovering the gap list.

See also [ANDROID_APK.md](ANDROID_APK.md).

## Shipping now (baseline)

- Progressive HTTPS stream of master `.mkv` via Media3 ExoPlayer (device **MediaCodec HEVC**)
- Media3 PlayerView controls (play / pause / seek / scrub)
- Audio focus + basic MediaSession (headset play/pause)
- Keep screen on while playing
- Decode / extractor failure → clear message + external handoff
- Open in external player (`ACTION_VIEW` / chooser)
- Save offline to app-private storage
- Landscape immersive theater on the native Flashback shell

## Not chasing in this pass

| Feature | Why deferred | Notes for a later session |
|---------|--------------|---------------------------|
| Soft HEVC / FFmpeg extension | Large per-ABI libs, APK size, licensing/maintenance | Revisit if many devices fail HW decode |
| Embedded MKV subtitle / audio track pickers | Sidecar VTT/SRT only today | Media3 extractor track selection UI |
| Nova-style Bluetooth A/V lip-sync tuning | Niche; ExoPlayer + audio focus is enough for most headsets | A2DP latency compensation |
| Chromecast / DLNA / remote casting | Extra modules + UX | media3-cast or Cast SDK |
| Picture-in-picture | Activity / manifest work | After theater UX is stable |
| Playlist / queue / resume-across-titles | Catalog is per-title | SharedPreferences resume position is a small first step |
| Deinterlace, frame-step, A-B loop | Power-user | Rarely needed for feature cuts |
| Playback speed UI polish | Media3 supports speed; no custom chrome | Optional chip row |
| Network bookmarks outside Flashback | Out of product scope | External players already do this |
| Equalizer / audio effects | Out of scope | VLC |
| Register as system `video/*` handler | Support burden; Flashback is a theater, not a general player | Optional intent-filters later |
| Gesture seek / double-tap skip | Custom overlay | After PlayerView baseline |
| Rich lock-screen / notification media UI | Beyond basic MediaSession | media3-session notification provider |
| TV leanback browse rows | Optional LEANBACK_LAUNCHER only | Leanback BrowseSupportFragment |
| Multi-audio / forced subs / ASS styling | Matroska complexity | Track picker + subtitle decoder |
| Offline DRM / encrypted packs | N/A — Flashback is ownership-gated clear streams | Do not add |

## Escape hatch

Anything in the “not chasing” table that a user needs **today** is answered by **Open in external player** (install VLC). Same HTTPS master URL; no remux required.

## How to use this doc

When starting a playback polish session, pick one row, move it into [ANDROID_APK.md](ANDROID_APK.md) “Current behavior” when shipped, and leave a one-line pointer here to the PR or commit.
