# Android APKs

Flashback on Android is two builds of the Relay client (`clevertree/react-client-android`, checkout `relay-client-android`). Neither APK vendors movies. The **Flashback** flavor is a **Kotlin-native shell** (catalog + ownership + ExoPlayer). The **Relay** flavor still loads any origin’s client hook via CleverScript.

Download (when published): **[flashback.apk](/downloads/flashback.apk)** — see [downloads/README.md](../downloads/README.md).

Deferred player features (VLC/Nova-class, not in v1): **[ANDROID_PLAYER_BACKLOG.md](ANDROID_PLAYER_BACKLOG.md)**.

## Playback (Flashback native shell)

Published masters are **HEVC Matroska (`.mkv`)**. In-app play uses **Media3 ExoPlayer** with the device’s **hardware HEVC** decoder over progressive HTTPS (Range requests; no multi‑GB disk cache thrash). Catalog paths with spaces are percent-encoded before bind.

- **Play in app** — after ownership confirm → immersive landscape theater (full-bleed player).
- **Open in external player** — theater “External” chip or error-card action (`ACTION_VIEW` / `video/*`); pick VLC and optionally Always.
- **Save offline** — full file under app-private storage (notification while downloading).
- If decode fails (common on devices without HEVC hardware): **PlaybackErrors** card (not a truncated Toast) plus Open in external player / Get VLC. Install [VLC for Android](https://play.google.com/store/apps/details?id=org.videolan.vlc) for that long tail.

Soft FFmpeg decode is **not** shipped (APK size / licensing). See the backlog doc.

### How to test playback

1. Install `downloads/flashback.apk` (or `assembleFlashbackDebug` output) on a device/emulator with **HEVC hardware**.
2. Open the app → library loads from `https://flashbackrepository.org/index.json`.
3. Optional: **Lab** → HEVC probe, **Simulate decode error** (full card), **Try sample stream** (prefers a `showing` master such as The Mummy Debugged).
4. Pick **The Mummy (1999) — Debugged** → **OK — I confirm** (hits POST once) → landscape theater should buffer and play.
5. Scrub / pause; confirm Range/`Accept-Ranges` on the gateway if diagnosing stalls (`curl -I` the encoded `.mkv` URL).
6. Force a decode failure path on non-HEVC hardware: error card → **Open in external player**.

Web checklist: **[/android-lab](/android-lab)**.
## Flavors

| APK | Application id | What you see |
|-----|----------------|--------------|
| Generic Relay | `com.relay.pure` | Server list, repo tabs, shell settings. Any Relay origin via **HookRenderer** + client hook. |
| Flashback Repository | `com.flashback.repository` | Baked `https://flashbackrepository.org`. **Native UI** (no CleverScript paint): library from `/index.json`, title + ownership keys shared with the web, ExoPlayer theater. Menu opens Setup / Legal / Motivation / Terms / Request via fetched `content/*.md` (`RelayMarkdownView`); Board opens the site in a browser; Lab is in-app. |
Build from `relay-client-android/android`:

```bash
./gradlew :app:assembleRelayDebug :app:assembleFlashbackDebug
```

## Native reusable pieces

- `RelayVideoPlayerView` — ExoPlayer + MediaSession + external handoff (also used if the hook path mounts `relay-video-player`). Decode failures use a full-screen error **card** (not a truncated Toast) with Open in external player / Get VLC. Native Flashback theater hides the Save-offline chrome so it does not cover PlayerView controls.
- `FlashbackCatalog` — `/index.json` parse + percent-encoded `masterStreamUrl` (spaces in paths); JVM unit-tested.- `PlaybackErrors` — classified user copy (decoder / network / format); JVM unit-tested.
- `HevcCapability` — MediaCodec HEVC hardware probe for the in-app **Lab**.
- `ExternalMediaIntents` — `intent:` / HTTPS / chooser open helper.
- `RelayMarkdownView` — Markwon-based markdown TextView for blurbs and docs **without** themed-styler (same origin `.md` files the web uses).

## Compatibility testing

- In-app: library → **Lab** (HEVC probe, simulate error overlay, sample stream).
- Web checklist: **[/android-lab](/android-lab)** (`content/android-lab.md`).
- Unit tests: `./gradlew :app:testFlashbackDebugUnitTest` in `relay-client-android/android`.

## Client-hook path (deferred polish)

CleverScript hosts under `hooks/client/native/*.android.js` remain for the generic Relay client and future Flashback hook-parity work. Flashback product v1 does **not** require hook paint. Ownership storage keys stay aligned: `flashback.ownershipAck.v1`, `flashback.movieOwn.v1.<slug>`.

## Permissions

`INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `WAKE_LOCK`. Touchscreen and Leanback are optional so a remote can drive the same APK.
