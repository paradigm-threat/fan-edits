# Plan: Bunny for Now Showing only (IPFS stays primary)

**Status:** titled masters under slug folders; catalog wired with `streamHttps`.  
**Updated:** 2026-10-11.

**NAS sync (this session — only this folder):** `//nobiserv/Public/Videos/FanEdits/`  
**Plan on NAS:** `…/Videos/FanEdits/docs/BUNNY_NOW_SHOWING_PLAN.md`  
**Repo copy:** `fan-edits/docs/BUNNY_NOW_SHOWING_PLAN.md`  
Do **not** sync to home share, HD mirrors, or other Public trees.

---

## Product split (locked)

| Layer | Role |
|-------|------|
| **IPFS catalog** (Git stubs + `assets.manifest.json`) | **Primary** library — APK / browser pull CIDs from the swarm |
| **Now showing** (Bunny CDN HTTPS) | **Extra**, temporary — carousel titles may come and go |
| **Relay masters** | **No** feature-movie cache / Kubo pins of fan-edits media |

Do **not** put Bunny URLs into `media` / `mediaWeb` / `mediaMobile`. Use `streamHttps*` only.

---

## File naming (locked — all Bunny / S3 uploads)

**Never** store uploads as `master.mkv`, `master.mp4`, etc. Downloads keep the object basename; `master` is untrackable in a downloads folder.

Object names must be **URL-path safe without percent-encoding**: only `A–Z` `a–z` `0–9` `_` `-` `.`

| Rule | Example |
|------|---------|
| Object name = **full display title**, spaces → `_` | `The Mummy (1999) — Debugged` → `The_Mummy_1999_-_Debugged.mkv` |
| Normalize em/en dashes to ASCII `-` | `—` / `–` → `-` |
| Drop parentheses (years stay as digits) | `(1999)` → `1999` |
| Apostrophe / other punctuation → `_` or drop | `DeAnna'd` → `DeAnna_d` |
| **No** `%` encoding in `streamHttps` path segments | link basename == object name |
| Keep slug **folder**; title lives in the **filename** | `now-showing/<slug>/<Title_Safe>.mkv` |

Optional ladder (same title stem; H.264 MP4 from `encode-ladder-nvenc.sh`):

- `now-showing/<slug>/<Title_Safe>_web-1080p.mp4`
- `now-showing/<slug>/<Title_Safe>_mobile-720p.mp4`

---

## Bunny layout (required format — follow this)

```text
now-showing/
  <slug>/
    <Title_Safe>.mkv              # required for Now showing
    <Title_Safe>_web-1080p.mp4    # optional — enable only when present
    <Title_Safe>_mobile-720p.mp4  # optional — enable only when present
```

**CDN host:** `flashbackrepository.b-cdn.net`

| Slug | Live master URL |
|------|-----------------|
| `the-mummy-1999-debugged` | `https://flashbackrepository.b-cdn.net/now-showing/the-mummy-1999-debugged/The_Mummy_1999_-_Debugged.mkv` |
| `the-mummy-returns-2001-debugged` | `https://flashbackrepository.b-cdn.net/now-showing/the-mummy-returns-2001-debugged/The_Mummy_Returns_2001_-_Debugged.mkv` |
| `van-helsing-deanna-d` | `https://flashbackrepository.b-cdn.net/now-showing/van-helsing-deanna-d/Van_Helsing_2004_-_DeAnna_d.mkv` |

Then add to `now-showing.json`:

```json
{
  "slug": "the-mummy-1999-debugged",
  "streamHttps": "https://flashbackrepository.b-cdn.net/now-showing/the-mummy-1999-debugged/The_Mummy_1999_-_Debugged.mkv",
  "streamHttpsWeb": "https://flashbackrepository.b-cdn.net/now-showing/the-mummy-1999-debugged/The_Mummy_1999_-_Debugged_web-1080p.mp4",
  "streamHttpsMobile": "https://flashbackrepository.b-cdn.net/now-showing/the-mummy-1999-debugged/The_Mummy_1999_-_Debugged_mobile-720p.mp4"
}
```

Until those fields exist, the theater shows **1080p (soon)** / **720p (soon)** as **disabled** (catalog still lists `mediaWeb` / `mediaMobile` placeholders).

---

## `now-showing.json` format

Prefer objects (slug-only strings still work for rotation without Bunny):

```json
[
  {
    "slug": "the-mummy-1999-debugged",
    "streamHttps": "https://flashbackrepository.b-cdn.net/now-showing/the-mummy-1999-debugged/The_Mummy_1999_-_Debugged.mkv"
  }
]
```

Pipeline: `now-showing.json` → `scripts/generate-index-json.py` → `index.json` (`nowShowing` slug list + `streamHttps*` on projects) → `get.jsx` / `ExternalPlay`.

---

## Secrets (per machine, not on NAS)

`~/.config/flashback/bunny.env` (`chmod 600`):

- `BUNNY_API_KEY`, `BUNNY_STORAGE_ZONE=flashbackrepository`, `BUNNY_STORAGE_PASSWORD`
- `BUNNY_STORAGE_REGION_HOST=storage.bunnycdn.com`
- `BUNNY_CDN_HOST=flashbackrepository.b-cdn.net`
- `BUNNY_PULL_ZONE_ID=6781451`

Server-side move/copy: S3 API at `https://de-s3.storage.bunnycdn.com` (Access Key = zone name, Secret = zone password).

---

## Sync checklist

| Step | Done? |
|------|--------|
| Move 3 masters to slug folders | yes |
| Rename `master.mkv` → titled filenames (underscores) | yes (2026-10-11) — no `master.*` under `now-showing/` |
| Drop parens / encoding chars from object names | yes — e.g. `The_Mummy_1999_-_Debugged.mkv` |
| CDN HEAD/Range 200/206 on titled paths | yes |
| Delete flat root MKVs | yes (purge CDN if old URLs still cache) |
| Wire `streamHttps` in catalog + ExternalPlay | yes |
| Disable 1080p/720p until Bunny ladder exists | yes |
| Upload helper enforces titled names (`scripts/bunny-now-showing-put.sh`) | yes |
| Upload web-1080p / mobile-720p + enable URLs | in progress (this host; publish per title) |
| Fleet IPFS movie cache retired | pending |
| `git push` tip / publish | yes (titled `streamHttps` on tip) |

---

## Out of scope

- Replacing IPFS catalog with Bunny  
- Putting `bunny.env` on NAS  
- Fleet wipe (separate)  
