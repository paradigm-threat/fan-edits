# Flashback APK downloads

Published installs live at same-origin URLs:

| File | Use |
|------|-----|
| **[flashback.apk](https://flashbackrepository.org/downloads/flashback.apk)** | Universal (arm64 + 32-bit). Default download / Setup link. |
| **[flashback-arm64-v8a.apk](https://flashbackrepository.org/downloads/flashback-arm64-v8a.apk)** | Phones / 64-bit devices (smaller). |
| **[flashback-armeabi-v7a.apk](https://flashbackrepository.org/downloads/flashback-armeabi-v7a.apk)** | Fire TV / older 32-bit Android TV. |

Version metadata for in-app update checks:

**https://flashbackrepository.org/downloads/flashback.json**

```json
{
  "versionCode": 20,
  "versionName": "1.0.20",
  "apkUrl": "https://flashbackrepository.org/downloads/flashback.apk",
  "apkUrls": {
    "armeabi-v7a": "https://flashbackrepository.org/downloads/flashback-armeabi-v7a.apk",
    "arm64-v8a": "https://flashbackrepository.org/downloads/flashback-arm64-v8a.apk"
  }
}
```

The Flashback APK fetches this JSON from `RELAY_DEFAULT_ORIGIN` (`/downloads/flashback.json`), compares `versionCode` to the installed app, and offers a one-tap install of the ABI-matching URL when present (else `apkUrl`).

The latest APKs are kept in this folder in the **git tip** (not on IPFS / `.relay` assets). That is intentional so the public download link stays a normal site path.

## Signing (release, not debug)

Publish **`assembleFlashbackRelease`** only. Debug-signed APKs (`CN=Android Debug`) are what Play Protect often labels “unsafe.”

- Keystore (local, not in git): `~/.android/flashback-release.keystore`
- Credentials file (gitignored): `relay-client-android/android/keystore.properties` (copy of `~/.android/flashback-release.keystore.credentials`)
- Gradle wires `signingConfigs.release` from that file, or from `-PKEYSTORE_PATH` / `ANDROID_KEYSTORE_*` for CI

Release signing does **not** silence Play Protect for sideload. Users still allow install once (see [Setup](/setup)). Without Play Store distribution, that allow step is the practical path.

**Signer change:** anyone who installed an older debug-signed build must **uninstall** before installing this release-signed APK (Android will not update across different signatures).

Verify before publishing:

```bash
apksigner verify -v --print-certs downloads/flashback.apk
# Expect DN containing "Flashback Repository", not "Android Debug"
```

## Publish a build

Native `librelay_runtime.so` must exist for **armeabi-v7a** and **arm64-v8a** under
`relay-client-android/android/app/src/main/jniLibs/` (build via
`relay-runtime/scripts/build-android.sh`, which builds armv7 + arm64).

From the Relay client checkout:

```bash
cd /path/to/relay-client-android/android
# Requires android/keystore.properties (see Signing above)
./gradlew :app:publishFlashbackDownloads \
  -PflashbackDownloadsDir=/path/to/fan-edits/downloads \
  -PflashbackManifestOut=/path/to/fan-edits/downloads/flashback.json
```

That runs `assembleFlashbackRelease` (ABI splits + universal), copies:

- `flashback.apk` ← universal
- `flashback-armeabi-v7a.apk`
- `flashback-arm64-v8a.apk`
- `flashback.json`

Use `assembleFlashbackDebug` only for local device testing — do not copy debug APKs into `downloads/`.

Commit the three APKs **and** `downloads/flashback.json` with the catalog tip, then push to the site’s publish remote (`iad1` → `main` for flashbackrepository.org). Do **not** add the APK under `.relay/assets` for the public download link.
