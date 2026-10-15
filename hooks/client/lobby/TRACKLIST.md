# Flashback lobby OST — tracklists

Logical playlist: [`lobby.playlist.json`](./lobby.playlist.json).  
Audio lives on Bunny CDN (`lobby/public-domain/`, `lobby/christmas/`) — not in git.

## Default song: `publicDomain`

Harkins-style classical lobby (Mozart-era + common PD staples). Prefer PD/CC0/CC-BY **recordings**.

| Id | Title | Expected file | Source / license |
|----|-------|---------------|------------------|
| pd-01 | Mozart — Eine kleine Nachtmusik, I. Allegro | `01-mozart-eine-kleine-nachtmusik-i.mp3` | Internet Archive classical upload (composition PD; recording treated as free reuse for lobby seed) |
| pd-02 | Mozart — Eine kleine Nachtmusik, II. Romanze | `02-mozart-eine-kleine-nachtmusik-ii.mp3` | same set as pd-01 |
| pd-03 | Mozart — Eine kleine Nachtmusik, III. Menuetto | `03-mozart-eine-kleine-nachtmusik-iii.mp3` | same set as pd-01 |
| pd-04 | Mozart — Eine kleine Nachtmusik, IV. Rondo | `04-mozart-eine-kleine-nachtmusik-iv.mp3` | same set as pd-01 |
| pd-05 | Mozart — Symphony No. 40, I. Molto allegro | `05-mozart-symphony-40-i.mp3` | [IA 78](https://archive.org/details/78_symphony-no-40-in-g-minor-k550_mozart-vienna-philharmonic-orchestra-wilhelm-furt_gbia7013241b) — George Blood / 78rpm |
| pd-06 | Mozart — Le nozze di Figaro, Overture | `06-mozart-figaro-overture.mp3` | Internet Archive 78rpm-style upload (composition PD) |
| pd-07 | Mozart — Die Zauberflöte, Overture | `07-mozart-magic-flute-overture.mp3` | Internet Archive 78rpm-style upload (composition PD) |
| pd-08 | Mozart — Piano Concerto No. 21, II. Andante | `08-mozart-piano-concerto-21-ii.mp3` | _(gap — no clean PD/CC master found this pass)_ |
| pd-09 | Mozart — Clarinet Concerto, II. Adagio | `09-mozart-clarinet-concerto-ii.mp3` | _(gap)_ |
| pd-10 | Mozart — Ave verum corpus, K. 618 | `10-mozart-ave-verum-corpus.mp3` | [IA 78](https://archive.org/details/78_ave-verum_c-warwick-evans-mozart-squire_gbia0085457a) — George Blood / 78rpm |
| pd-11 | Bach — Air on the G String | `11-bach-air-on-the-g-string.mp3` | [IA](https://archive.org/details/AirOnTheGStringviolincello) |
| pd-12 | Bach — Brandenburg Concerto No. 3, I | `12-bach-brandenburg-3-i.mp3` | [IA 78](https://archive.org/details/78_brandenburg-concerto-no-3-in-g-major_j-s-bach_gbia0479750b) — George Blood / 78rpm |
| pd-13 | Handel — Water Music, Alla Hornpipe | `13-handel-water-music-hornpipe.mp3` | [IA 78](https://archive.org/details/78_hornpipe_philharmonia-orchestra-of-hamburg-george-frederick-handel-hans-jrgen-walt_gbia0268936) — George Blood / 78rpm |
| pd-14 | Handel — Messiah, Hallelujah | `14-handel-messiah-hallelujah.mp3` | [IA 78](https://archive.org/details/78_hallelujah-chorus_handel_gbia3006123a) — George Blood / 78rpm |
| pd-15 | Vivaldi — The Four Seasons, Spring I | `15-vivaldi-spring-i.mp3` | John Harrison / Wichita State Chamber Players — [CC BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/) via [IA](https://archive.org/details/musica-John_Harrison_with_the_Wichita_State_University_Chamber_Players_-_01_-_Spring_Mvt_1_Allegro) |

**Ingested this pass:** pd-01–07, pd-10–15 (12 tracks). Gaps: pd-08, pd-09.

## Christmas song: `christmas`

Canonical target: **Mannheim Steamroller — Christmas Symphony II** (2013).

Bridge until that rip is available: overlapping tracks from *A Fresh Aire Christmas* + *Christmas Extraordinaire* in `~/Music`.

| # | Symphony II title | Bridge source (local) | Bunny file |
|---|-------------------|------------------------|------------|
| 1 | Carol of the Bells | Fresh Aire 10 | `01-carol-of-the-bells.mp3` |
| 2 | Veni Veni | Fresh Aire 03 | `02-veni-veni.mp3` |
| 3 | Away in a Manger | Extraordinaire 03 | `03-away-in-a-manger.mp3` |
| 4 | Joy to the World | _(missing)_ | |
| 5 | Christmas Lullaby | _(missing)_ | |
| 6 | Hallelujah | Extraordinaire 01 | `06-hallelujah.mp3` |
| 7 | Do You Hear What I Hear? | Extraordinaire 05 | `07-do-you-hear-what-i-hear.mp3` |
| 8 | Lo How a Rose E'er Blooming | Fresh Aire 07 | `08-lo-how-a-rose.mp3` |
| 9 | Traditions of Christmas | Fresh Aire 11 | `09-traditions-of-christmas.mp3` |
| 10 | Good King Wenceslas | _(missing)_ | |
| 11 | We Three Kings | _(missing)_ | |
| 12 | Pat a Pan/Fum, Fum, Fum Medley | Extraordinaire 08 (Fum, Fum, Fum only) | `12-fum-fum-fum.mp3` |
| 13 | Auld Lang Syne | Extraordinaire 12 | `13-auld-lang-syne.mp3` |

**Bridge note:** private CD rips for lobby CDN only — replace with *Christmas Symphony II* when available. Not redistributed in git.

## Season

- **Christmas:** local date Nov 15 – Jan 2 inclusive → song `christmas`
- **Otherwise:** default song `publicDomain`
