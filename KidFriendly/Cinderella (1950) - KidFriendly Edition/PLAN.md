# Editorial plan: *Cinderella* (1950) — KidFriendly Edition

Companion to [README.md](README.md) and [remove-cinderella-kidfriendly-ranges.json](remove-cinderella-kidfriendly-ranges.json).

## Goals (age ~3)

| Goal | Success |
|------|---------|
| No frightening cruelty | Stepmother/sisters bullying, dress destruction, attic lockup removed |
| No predatory cat violence | Lucifer chasing/hurting mice cut |
| No Bruno “chases cats in dreams” beat | Removed with Lucifer/Bruno block (~9:12–11:01) |
| Keep magic and joy | Dream song, mice songs, ball invitation, Fairy Godmother, dance, happy ending |

## Removal blocks (source timeline, seconds)

| Block | ~Time | Content |
|-------|--------|---------|
| 1 | 2:22–3:13 | Father’s death; cruel stepmother narration |
| 2 | 9:06–11:01 | Lucifer menace; Bruno “dreaming/chasing Lucifer” |
| 3 | 12:59–18:54 | Breakfast chaos; cat vs Gus; stepmother orders |
| 4 | 19:44–23:24 | Morning bullying; Lucifer at music lesson |
| 5 | 29:55–30:23 | “I said *if*” manipulation |
| 6 | 37:00–39:27 | Chore punishment list (close door scene) |
| 7 | 40:32–43:21 | Dress ripped; thief accusations; despair → jump to Fairy Godmother |
| 8 | 55:07–55:36 | Midnight guard/coach chase |
| 9 | 61:23–66:58 | Cruel morning; attic imprisonment; Lucifer at door |

**Joins:** Large jumps use hard cuts (`join_fade: false`) or optional 0.35 s dip when gap > 72 s removed (see `generate-cinderella.sh`).

## Subtitles

Source rip has **PGS** subs only. Working copy: English SRT from YIFY-aligned release ([subtitlecat](https://subtitlecat.com/subs/898/Cinderella.1950.1080p.BluRay.x264.YIFY-en.srt)) for timing; output uses `.kdenlive.shifted.srt` on the edit timeline.

## Changelog

- 2026-05-24 — Initial cut list (manual scenes, 9 ranges); ~50 min output from ~74 min source.
- 2026-05-24 — NAS encode failed ~10 min in; source copied to `C:\Videos\FanEditRender\`; render restarted from local path per [LLM-FAN-EDIT-INSTRUCTIONS.md](../../docs/LLM-FAN-EDIT-INSTRUCTIONS.md) §5 Phase F.
- 2026-05-25 — Local two-pass render completed (~50 min / 2.39 GB): `C:\Videos\FanEditRender\Cinderella (1950) - KidFriendly Edition.mkv`.
