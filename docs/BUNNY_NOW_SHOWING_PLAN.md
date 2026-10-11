# Plan: Bunny for Now Showing only (IPFS stays primary)

**Status:** masters live under slug folders; catalog wired with `streamHttps`.  
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

## Bunny layout (required format — follow this)

```text
now-showing/
  <slug>/
    master.mkv                 # required for Now showing
    web-1080p.mkv              # optional — enable only when present
    mobile-720p.mkv            # optional — enable only when present
```

**CDN host:** `flashbackrepository.b-cdn.net`

| Slug | Live master URL |
|------|-----------------|
| `the-mummy-1999-debugged` | `https://flashbackrepository.b-cdn.net/now-showing/the-mummy-1999-debugged/master.mkv` |
| `the-mummy-returns-2001-debugged` | `https://flashbackrepository.b-cdn.net/now-showing/the-mummy-returns-2001-debugged/master.mkv` |
| `van-helsing-deanna-d` | `https://flashbackrepository.b-cdn.net/now-showing/van-helsing-deanna-d/master.mkv` |

When adding 1080p/720p later, upload as:

- `now-showing/<slug>/web-1080p.mkv`
- `now-showing/<slug>/mobile-720p.mkv`

Then add to `now-showing.json`:

```json
{
  "slug": "the-mummy-1999-debugged",
  "streamHttps": "https://flashbackrepository.b-cdn.net/now-showing/the-mummy-1999-debugged/master.mkv",
  "streamHttpsWeb": "https://flashbackrepository.b-cdn.net/now-showing/the-mummy-1999-debugged/web-1080p.mkv",
  "streamHttpsMobile": "https://flashbackrepository.b-cdn.net/now-showing/the-mummy-1999-debugged/mobile-720p.mkv"
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
    "streamHttps": "https://flashbackrepository.b-cdn.net/now-showing/the-mummy-1999-debugged/master.mkv"
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
| Move 3 masters to `now-showing/<slug>/master.mkv` | yes |
| CDN HEAD/Range 200/206 on new paths | yes |
| Delete flat root MKVs | yes (purge CDN if old URLs still cache) |
| Wire `streamHttps` in catalog + ExternalPlay | yes (local tip; publish when ready) |
| Disable 1080p/720p until Bunny ladder exists | yes |
| Upload web-1080p / mobile-720p + enable URLs | pending |
| Fleet IPFS movie cache retired | pending |
| `git push` tip / publish | pending |

---

## Out of scope

- Replacing IPFS catalog with Bunny  
- Putting `bunny.env` on NAS  
- Fleet wipe (separate)  
