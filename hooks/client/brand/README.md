# Flashback Repository — Logo & Icon Set

Antique gold on near-black. **Header logo** = horizontal wordmark (film-strip + name + tagline). **App / PWA icon** = stacked mark (film-strip with **FLASHBACK / REPOSITORY** text below). Do **not** use the retired flat three-node mark. Source under `svg/` and `png/`. Atmosphere under `jpg/`.

## In repo

| Path | Role |
|------|------|
| `png/logo-header.png` | Header wordmark (text baked into image) |
| `png/banner-wide.png` | Stacked mark + FLASHBACK / REPOSITORY (source for app icon) |
| `png/logo-primary-800.png` | Large film-strip still (no text) |
| `png/icon-512.png` | App / PWA icon (stacked mark + text, square) |
| `png/icon-192.png` | PWA / small brand mark (same art) |
| `jpg/velvet/theater-bg-*.jpg` | **Default** illustrated curtain covers (mobile / tablet / desktop / wide) |
| `jpg/classic/theater-bg-*.jpg` | Alternate photo-aisle covers (same breakpoints) |
| `svg/logo-primary.svg` | Legacy full wordmark (optional) |
| `svg/logo-compact.svg` | Legacy header wordmark (optional) |
| `svg/logo-mono.svg` | Legacy white mono |
| `svg/favicon.svg` | Prefer `png/icon-192.png` for app surfaces |
| `../favicon.svg` | Site favicon |

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
