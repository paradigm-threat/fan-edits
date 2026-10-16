# Flashback Repository — poster / artwork style

Use this when prompting ChatGPT, Midjourney, Flux, or similar to generate FanMix artwork. Canonical on-disk file for the catalog is still **`FanMixes/<Title>/poster.jpg`** (vertical one-sheet). Extra crops below are optional companions for apps and embeds.

Reference posters (house look):

- `FanMixes/The Mummy (1999) - Debugged/poster.jpg`
- `FanMixes/2012 (2009) - Salvation/poster.jpg`
- `FanMixes/Congo (1995) - Adult Supervision/poster.jpg`
- `FanMixes/War of the Worlds (2005) - Family Therapy/poster.jpg`

---

## House style (always)

1. **Ornate thematic frame** — thick gold / bronze decorative border around the whole image. Motif matches the film (Egyptian, Art Deco Wall Street, jungle pulp, Mayan/ark, Victorian invasion, etc.). Not a bare borderless stock photo.
2. **Corner medallions** — four small icons inside the frame, themed to the cut (scarabs, business card, tripods, ark glyph, etc.).
3. **Cinematic center** — one clear dramatic scene for the edit’s thesis. Painterly / prestige digital art, subtle grain OK. Not collage spam.
4. **Typography hierarchy**
   - Large metallic / embossed serif **TITLE**
   - Elegant gold serif **EDIT NAME** (often flanked by thin gold lines)
   - Optional gold **YEAR**
   - Clean white serif **tagline**
5. **Bottom credit strip** (small caps):  
   `A FAN EDIT BY FLASHBACK REPOSITORY • <SHORT CUT LABEL>`
6. **No** studio logos, celebrity likeness claims, watermarks, meme text, purple-glow AI defaults, or gore-festival clutter unless the edit’s thesis requires restrained implication (still avoid snuff spectacle).

Brand gold language should rhyme with site brand (`hooks/client/brand/` — antique gold on near-black), not fight it.

---

## Copy-paste prompt boilerplate

Paste this block first, then append the title-specific scene, tagline, and corner icons.

```text
Create a theatrical fan-edit movie poster in the Flashback Repository house style
(same family as The Mummy Debugged, 2012 Open The Gates, Congo Adult Supervision,
War of the Worlds Family Therapy):

- Thick ornate gold/bronze decorative border around the entire image; film-themed filigree
- Four corner medallions with small thematic icons (specify per title)
- Vertical classic one-sheet composition unless a different aspect ratio is requested below
- Large metallic/embossed serif TITLE
- Elegant gold serif EDIT NAME under the title, often between thin gold lines
- Optional gold YEAR
- Clean white serif TAGLINE
- Bottom credit strip in small caps:
  A FAN EDIT BY FLASHBACK REPOSITORY • <SHORT CUT LABEL>
- Prestige cinematic digital art, muted gold accents echoing the frame
- No studio logos, no watermarks, no celebrity likeness, no meme text, no purple AI glow,
  no crowded face collage

Then the title-specific brief:
- Film / edit name / year / tagline / cut label
- Central scene (thesis of the cut; what to show / what to avoid)
- Border motif + four corner icons
- Color grade notes
```

---

## Aspect ratios & suggested resolutions

Generate each crop as its **own** image (or regenerate with the same brief + ratio). Do not stretch a vertical poster into a banner.

| Role | Aspect | Suggested px | Filename (optional) | Used for |
| --- | --- | --- | --- | --- |
| **Catalog poster (required)** | **2:3** portrait | **1000×1500** (or 2000×3000 master) | `poster.jpg` | Site catalog, README embed, most list UIs |
| Wide hero / landscape poster | **16:9** | **1920×1080** or **3840×2160** | `poster-wide.jpg` | Web heroes, TV / Fire TV rows, YouTube thumb-ish |
| Ultrawide banner | **21:9** | **3440×1440** | `poster-ultrawide.jpg` | Ultrawide theater / desktop headers (see brand theater-bg-wide) |
| Landscape banner (short) | **3:1** | **2400×800** | `poster-banner.jpg` | App headers, social link previews |
| Square | **1:1** | **1080×1080** or **2048×2048** | `poster-square.jpg` | App tiles, social avatars / share cards |
| Mobile story / reel | **9:16** | **1080×1920** | `poster-story.jpg` | Stories, mobile full-bleed (same ratio family as theater-bg-mobile) |
| Tablet portrait cover | **3:4** | **1536×2048** | `poster-tablet.jpg` | Optional tablet cover (theater-bg-tablet family) |

**Prompt tip:** after the boilerplate, add one line, e.g.:

- `Aspect ratio 2:3 vertical one-sheet, 2000×3000.`
- `Aspect ratio 16:9 landscape hero, 3840×2160; keep ornate frame on all four sides; title left or lower-third so the wide skyline can breathe.`
- `Aspect ratio 21:9 ultrawide banner, 3440×1440; panoramic center; title and tagline readable at small height.`

For landscape / ultrawide: keep the **same ornate frame and corner icons**, but recompose the center as a **panorama** (city skyline, ark gates, invasion horizon) — do not letterbox a 2:3 poster inside a wide canvas.

---

## Per-title checklist

- [ ] Tagline matches README slogan
- [ ] Edit name matches folder (`Psychosomatic`, `Debugged`, …)
- [ ] Corner icons support the cut’s thesis (not random decoration)
- [ ] `poster.jpg` committed as tip binary (not IPFS-ingested) — see `IPFS-SEEDING.md`
- [ ] Optional wide/square crops only if an app or page will use them
