# Android APKs

Flashback on Android is two builds of the Relay client (`clevertree/react-client-android`, checkout `relay-client-android`). Neither APK vendors movies. The **Flashback** flavor is a **Kotlin-native shell** (catalog + ownership + ExoPlayer). The **Relay** flavor still loads any origin’s client hook via CleverScript.

Public install page: **[/app](/app)** (versioned downloads + sideload troubleshooting). Binary paths under `/downloads/` are linked from there — prefer sharing `/app`, not raw APK URLs. ABI splits and publish notes: [downloads/README.md](../downloads/README.md).

Published APKs must be **release-signed** (`assembleFlashbackRelease` / `publishFlashbackDownloads`). Debug certs trigger Play Protect “unsafe app” more often; release signing helps but does not remove the sideload prompt — users still tap Install anyway (documented on [App](/app)). Keystore: `~/.android/flashback-release.keystore` (not in git).

**Fire TV / 32-bit:** devices that only report `armeabi-v7a` need `librelay_runtime.so` for that ABI (or the universal APK that includes it). Older tip APKs shipped only arm64 + x86_64 and failed with `INSTALL_FAILED_NO_MATCHING_ABIS`.

Deferred player features (VLC/Nova-class, not in v1): **[ANDROID_PLAYER_BACKLOG.md](ANDROID_PLAYER_BACKLOG.md)**.

## Playback (Flashback native shell)

Published masters are **HEVC Matroska (`.mkv`)**. In-app play uses **Media3 ExoPlayer** with the device’s **hardware HEVC** decoder. **Media bytes are fetched over IPFS (Bitswap)** by an embedded Kubo daemon (`libkubo_daemon.so`) and streamed from `http://127.0.0.1:18080/ipfs/{cid}` with bounded Range requests — **not** via the Relay HTTPS `/ipfs/` gateway. Catalog JSON (`index.json`, `assets.manifest.json`) still loads over HTTPS from the origin.

- **Play in app** — after ownership confirm → immersive landscape theater (full-bleed player) once Kubo is ready.
- **Open in external player** — theater “External” chip or error-card action (`ACTION_VIEW` / `video/*`); pick VLC and optionally Always.
- **Keep offline** — title toggle pins the CID in on-device Kubo (`IpfsOfflineStore` + `ipfs pin add`). Delete unpins and runs repo GC. Ephemeral play fetches without a lasting pin.
- If decode fails (common on devices without HEVC hardware): **PlaybackErrors** card (not a truncated Toast) plus Open in external player / Get VLC. Install [VLC for Android](https://play.google.com/store/apps/details?id=org.videolan.vlc) for that long tail.

### IPFS / ABI notes (1.0.26+)

| ABI | Artifact | Mode |
|-----|----------|------|
| `arm64-v8a` | `flashback-arm64-v8a.apk` | Embedded Kubo (`IpfsSession.abiMode=kubo`) |
| `armeabi-v7a` | `flashback-armeabi-v7a.apk` | Same Kubo binary (GOARM / NDK armv7) |

Hardening: daemon auto-restart watchdog, `Datastore.StorageMax` (8 GB TV / 20 GB phone), GC watermark 90%, leave-theater `maybeGcIfOverBudget`. Sideload APKs omit x86_64 (emulator: `-PipfsIncludeX86=true`).

Rebuild Kubo prebuilts: `android/ipfs-kubo/build-kubo-android.sh` then `./gradlew :app:syncIpfsKubo`. Lab → **IPFS (embedded Kubo)** shows ABI mode, peers, Range probe, and Keep list.

Soft FFmpeg decode is **not** shipped (APK size / licensing). See the backlog doc.

### How to test playback

1. Install `downloads/flashback.apk` (or ABI split) **1.0.30+** on a device with **HEVC hardware** (arm64 phone or armeabi-v7a Fire TV).
2. Open the app → library loads from `https://flashbackrepository.org/index.json` (+ `assets.manifest.json` for CIDs). Kubo starts in the background.
3. **Lab** → **IPFS (embedded Kubo)** → Start node → Gateway Range probe; **Try sample via IPFS localhost**.
4. Pick **The Mummy (1999) — Debugged** → **OK — I confirm** → optional **Keep offline copy** → **Play** → theater streams from `127.0.0.1:18080/ipfs/{cid}` (status chip briefly).
5. Scrub once into a colder region; confirm rebuffer then resume (Bitswap catching up).
6. Force a decode failure path on non-HEVC hardware: error card → **Open in external player**.

Instrumented smoke (emulator x86_64 with prebuilt Kubo):  
`./gradlew :app:connectedFlashbackDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.relay.client.IpfsNodeSmokeTest`

Web checklist: **[/android-lab](/android-lab)**.

### Stream validation notes (HW HEVC)

Validated on phone (CPH2419) and emulator with Flashback **1.0.17+**:

| Check | Result |
|-------|--------|
| Device decode | `c2.qti.hevc.decoder` (or emulator MediaCodec HEVC) @ master resolution |
| Transport | Embedded Kubo → localhost gateway with **bounded Range** (`RangeEnforcingDataSource`, 4 MiB); catalog CIDs from `assets.manifest.json` |
| Buffer | LoadControl min ~50 s / max ~120 s for Bitswap / cold DHT |
| In-app URL | `http://127.0.0.1:18080/ipfs/{cid}` when Kubo ready — **no** Relay HTTPS `/ipfs/` fallback for Play |
| Escape hatch | Decode / open failure → PlaybackErrors card → Open in external player (VLC) |

**Requirement:** in-app play needs **hardware HEVC** (`minSdk 24`). Soft FFmpeg decode is not shipped. Without HW HEVC, use VLC via external handoff.

Probe a known master CID (The Mummy Debugged):

```bash
curl -sI -H "Range: bytes=0-1048575" \
  "https://flashbackrepository.org/ipfs/bafybeicfynx4o23njy4owttcziexmm4f6ibnqceharrhoxsvsbaaax7rxq"
# expect HTTP 206, Accept-Ranges: bytes, Content-Type: video/x-matroska
```

## Flavors

| APK | Application id | What you see |
|-----|----------------|--------------|
| Generic Relay | `com.relay.pure` | Server list, repo tabs, shell settings. Any Relay origin via **HookRenderer** + client hook. |
| Flashback Repository | `com.flashback.repository` | Baked `https://flashbackrepository.org`. **Native UI** (no CleverScript paint): library from `/index.json`, title + ownership keys shared with the web, ExoPlayer theater. Menu opens Setup / Legal / Motivation / Terms / Request via fetched `content/*.md` (`RelayMarkdownView`); Board is in-app; **Chat** is native IRC over the site chat-edge WebSocket (`/chat/ws`) with coalesced channel notifications; Lab is in-app. |
Build from `relay-client-android/android`:

```bash
# Local testing
./gradlew :app:assembleRelayDebug :app:assembleFlashbackDebug

# Site downloads (release-signed ABI splits + universal; needs keystore.properties)
./gradlew :app:publishFlashbackDownloads \
  -PflashbackDownloadsDir=/path/to/fan-edits/downloads
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

## Live chat (native IRC)

Web and the Flashback APK share the same Ergo + chat-edge stack (`/chat/api/*`, `WS /chat/ws`).

**APK Chat screen:** realtime join/send/history for lobby and catalog channels. Menu → **Chat**.

**Notifications:** every public channel is listed for individual opt-in (no join-all). Digests coalesce activity (default **10 minute** quiet window between alert sounds) so you know something is happening without a notice per PRIVMSG. Tap opens Chat on the most recent channel.

**Battery default:** IRC WebSocket runs while the app is in the foreground. **Keep listening in background** is opt-in (foreground service). Each watched channel is an IRC JOIN — pick only what you care about.

## Client-hook path (deferred polish)

CleverScript hosts under `hooks/client/native/*.android.js` remain for the generic Relay client and future Flashback hook-parity work. Flashback product v1 does **not** require hook paint. Ownership storage keys stay aligned: `flashback.ownershipAck.v1`, `flashback.movieOwn.v1.<slug>`.

## Permissions

`INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `WAKE_LOCK`. Touchscreen and Leanback are optional so a remote can drive the same APK.
