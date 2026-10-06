# Android APKs

Flashback on Android is two builds of the Relay client (`clevertree/react-client-android`, checkout `relay-client-android`). Neither APK vendors this repo’s hooks or movies. Both load a live Relay origin and paint that site’s client hook as native views. Video uses Media3 ExoPlayer (`relay-video-player`).

## Flavors

| APK | Application id | What you see |
|-----|----------------|--------------|
| Generic Relay | `com.relay.pure` | Server list, repo tabs, and shell settings. Any Relay origin. Skip-affirmation lives here. |
| Flashback Repository | `com.flashback.repository` | `https://flashbackrepository.org` is baked in. A lock flag (`RELAY_LOCK_ORIGIN`) never creates the server list, tabs, or shell settings. The site’s own screens, including its settings and gates, are the app. |

Build both from `relay-client-android/android`:

```bash
./gradlew :app:assembleRelayDebug :app:assembleFlashbackDebug
```

## Site hooks

CleverScript stays on `Foo.js` (web keeps `Foo.host.js`). Android prefers `Foo.android.js` when the shell fetches `hooks/client/native/`. Those files are CleverScript, not Kotlin:

- `Affirmation.android.js` — confirm dialog, same storage keys as the web host. Honors `@hooks` `relaySkipAffirmations` from the generic client.
- `NowShowing.android.js` — horizontal, remote-focusable row (`data-relay-scroll="x"`).
- `TheaterPlayer.android.js` — H.264 ladder (`srcMobile` → `srcWeb` → `srcMaster`) with seed probe per rung via `?relayAssetStatus=1`, then `@clevertree/video` `VideoPlayer`. Passes `subtitlesJson` for Media3 VTT/SRT tracks. Park-stub fallback in the shell also reads `data-src-mobile` / `data-src-web` / `data-subtitles-json`.

`npm test` includes `hooks/client/native/android-hosts.test.mjs`, which checks those files against the web stub’s exports, storage keys, and props. Playwright still covers `*.host.js` only.

## Shell behavior

- Import closure is fetched from the origin (not only `hooks.json`). Last good closure is the offline backup. Hooks are not copied into the APK.
- Full hook reload after 24 hours in the foreground, deferred while ExoPlayer is playing, so edits that are not QUERY updates show up. Flashback’s catalog is `fetch('/index.json')` inside the hook.
- Relative links navigate inside the app. The shell sets `globalThis.__relaySkipAffirmations` from the generic client’s setting and reads the site’s client GET path from `OPTIONS`. A `setTimeout` prelude lets the site’s hydrate gate open so playback can unlock.
- Flashback traffic is HTTPS. The generic client allows cleartext only for a server the user adds (and for localhost).
- Movie files can be saved in full under app-specific storage. Streaming uses a Media3 cache. The player asks for notification permission and runs a data-sync foreground service for the save. Broad external-storage grants are not requested.

## Permissions

`INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `WAKE_LOCK`. Touchscreen and Leanback are optional so a remote can drive the same APK.
