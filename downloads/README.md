# Flashback APK downloads

Published installs live at a stable same-origin URL:

**https://flashbackrepository.org/downloads/flashback.apk**

Version metadata for in-app update checks:

**https://flashbackrepository.org/downloads/flashback.json**

```json
{
  "versionCode": 13,
  "versionName": "1.0.13",
  "apkUrl": "https://flashbackrepository.org/downloads/flashback.apk"
}
```

The Flashback APK fetches this JSON from `RELAY_DEFAULT_ORIGIN` (`/downloads/flashback.json`), compares `versionCode` to the installed app, and offers a one-tap install of `apkUrl` (absolute HTTPS, or a path resolved against the origin).

The latest APK is kept in this folder in the **git tip** (not on IPFS / `.relay` assets). That is intentional so the public download link stays a normal site path.

## Publish a build

From the Relay client checkout:

```bash
cd /path/to/relay-client-android/android
./gradlew :app:assembleFlashbackRelease   # or assembleFlashbackDebug while testing
cp app/build/outputs/apk/flashback/*/app-flashback-*.apk \
  /path/to/fan-edits/downloads/flashback.apk

# Write version manifest from the same Gradle versionCode / versionName
./gradlew :app:writeFlashbackVersionManifest \
  -PflashbackManifestOut=/path/to/fan-edits/downloads/flashback.json
```

Or one-liner if you already know the version:

```bash
python3 - <<'PY'
import json
from pathlib import Path
Path("downloads/flashback.json").write_text(json.dumps({
    "versionCode": 13,
    "versionName": "1.0.13",
    "apkUrl": "https://flashbackrepository.org/downloads/flashback.apk",
}, indent=2) + "\n")
PY
```

Commit `downloads/flashback.apk` **and** `downloads/flashback.json` with the catalog tip, then push to the site’s publish remote (`iad1` → `main` for flashbackrepository.org). Do **not** add the APK under `.relay/assets` for the public download link.

Versioned copies (optional): `flashback-1.0.13.apk` plus keep `flashback.apk` as the “latest” link.
