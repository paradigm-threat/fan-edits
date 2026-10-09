# Flashback APK downloads

Published installs live at a stable same-origin URL:

**https://flashbackrepository.org/downloads/flashback.apk**

Version metadata for in-app update checks:

**https://flashbackrepository.org/downloads/flashback.json**

```json
{
  "versionCode": 14,
  "versionName": "1.0.17",
  "apkUrl": "https://flashbackrepository.org/downloads/flashback.apk"
}
```

The Flashback APK fetches this JSON from `RELAY_DEFAULT_ORIGIN` (`/downloads/flashback.json`), compares `versionCode` to the installed app, and offers a one-tap install of `apkUrl` (absolute HTTPS, or a path resolved against the origin).

The latest APK is kept in this folder in the **git tip** (not on IPFS / `.relay` assets). That is intentional so the public download link stays a normal site path.

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

From the Relay client checkout:

```bash
cd /path/to/relay-client-android/android
# Requires android/keystore.properties (see Signing above)
./gradlew :app:assembleFlashbackRelease
cp app/build/outputs/apk/flashback/release/app-flashback-release.apk \
  /path/to/fan-edits/downloads/flashback.apk

# Write version manifest from the same Gradle versionCode / versionName
./gradlew :app:writeFlashbackVersionManifest \
  -PflashbackManifestOut=/path/to/fan-edits/downloads/flashback.json
```

Use `assembleFlashbackDebug` only for local device testing — do not copy debug APKs into `downloads/`.

Or one-liner if you already know the version:

```bash
python3 - <<'PY'
import json
from pathlib import Path
Path("downloads/flashback.json").write_text(json.dumps({
    "versionCode": 14,
    "versionName": "1.0.17",
    "apkUrl": "https://flashbackrepository.org/downloads/flashback.apk",
}, indent=2) + "\n")
PY
```

Commit `downloads/flashback.apk` **and** `downloads/flashback.json` with the catalog tip, then push to the site’s publish remote (`iad1` → `main` for flashbackrepository.org). Do **not** add the APK under `.relay/assets` for the public download link.

Versioned copies (optional): `flashback-1.0.17.apk` plus keep `flashback.apk` as the “latest” link.
