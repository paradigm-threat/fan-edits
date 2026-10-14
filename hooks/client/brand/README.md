# Flashback Repository — Logo & Icon Set

Antique gold on near-black. **Header logo** = cinematic three-frame film strip (Relay path). **App / favicon** = flat three-node mark. Source under `svg/` and `png/`. Atmosphere under `jpg/`.

## In repo

| Path | Role |
|------|------|
| `png/logo-header.png` | Header mark (film-strip / landmarks) |
| `png/logo-primary-800.png` | Large logo still |
| `png/icon-512.png` | App / PWA icon |
| `png/icon-192.png` | PWA icon |
| `jpg/velvet/theater-bg-*.jpg` | **Default** illustrated curtain covers (mobile / tablet / desktop / wide) |
| `jpg/classic/theater-bg-*.jpg` | Alternate photo-aisle covers (same breakpoints) |
| `svg/logo-primary.svg` | Legacy full wordmark (optional) |
| `svg/logo-compact.svg` | Legacy header wordmark (optional) |
| `svg/logo-mono.svg` | Legacy white mono |
| `svg/icon-mark.svg` | Square app mark (flat Relay film) |
| `svg/favicon.svg` | Small mark |
| `../favicon.svg` | Site favicon (same art) |

### Theater themes

| Theme id | Look | Default? |
|----------|------|----------|
| `velvet` | Illustrated curtains + sconces + seats | yes |
| `classic` | Photo theater aisle | no |

Breakpoints (all themes):

| File | Size |
|------|------|
| `theater-bg-mobile.jpg` | **1080×1920** |
| `theater-bg-tablet.jpg` | **1536×2048** |
| `theater-bg-desktop.jpg` | **2560×1440** |
| `theater-bg-wide.jpg` | **3440×1440** |

Web: `localStorage` key `flashback.theaterTheme.v1` + `html[data-fb-theater]`. Header **Theme:** control cycles themes. CSS: `theater-bg.css`.

APK: `FlashbackTheaterPrefs` + Lab / drawer theme control; drawables `fb_theater_bg_velvet` / `fb_theater_bg_classic` per qualifier.

Raster root favicons / OG image may also live as **thin IPFS** (stubs under `.relay/assets/` / local under `.relay/local-assets/`):

- `/favicon.ico`, `/favicon-16x16.png`, `/favicon-32x32.png`
- `/apple-touch-icon.png`, `/android-chrome-192x192.png`, `/android-chrome-512x512.png`
- `/og-image.png`

`site.webmanifest` points at tip `hooks/client/brand/png/icon-*.png`.

## Palette

| Name | Hex |
|------|-----|
| Gold | `#E8C872` |
| Gold Mid | `#D4A84B` |
| Gold Dark | `#B8860B` |
| Cream | `#F5E6BE` |
| BG Dark | `#0D0505` |

## Motif

Three vertical film nodes linked by two bridges = Relay’s three-point / two-line path woven into Flashback’s film language.
