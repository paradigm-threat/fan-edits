# Why we’re doing this

This is not only about making better versions of movies.

It is about the **allowed** part.

Right now that permission does not feel real. Craft matters — cleaner pacing, less cruelty, a score that fits — but the deeper point is agency: if you **own** a film, you ought to be able to improve your copy and share that cut with friends without treating the act itself as radioactive.

## What the craft is usually fixing

Most titles in this library are chasing one or more of these:

- **Cringe and tone-breakers** — jokes, beats, or performances that yank you out of a movie that otherwise works  
- **Needless gore and violence** — especially when it isn’t load-bearing for the story (family-safer Debugged cuts, Silent Hill, etc.)  
- **Plot holes and muddy storytelling** — trim or reshape so the spine is clearer  
- **Obnoxious edit / post-production decisions** — choppy pacing, survivor’s-guilt comedy, or “fixes” that feel hostile to a film’s original warmth (*Van Helsing* is the loud case; the early *Mummy* pictures are the quieter one)  
- **Missing or compromised releases** — e.g. *Final Fantasy: The Spirits Within* never got the international Japanese-track release many of us wanted  

Often the score gets attention too: when it fits, cuts weave in **video game remixes** — not only in credits, but inside the film (*Silent Hill — Nay Tomorrow*, Sonic DeSchwartzed OC ReMixes, Castlevania beds in Van Helsing, and more). See [Submissions](/submit) if you want to contribute a cut the same way.

## Culture as leverage

Entertainment is not only product. In periods that lead up to war, large “global resets,” and consolidation of culture, messaging control intensifies. Cinema is a soft-power surface. The industry’s incentives are not aligned with letting audiences quietly reclaim ownership of the stories they already paid for.

You do not need a conspiracy flowchart for that observation. You need a clear rule: **own the original, then you may edit.**

## Warnings then and now

There used to be FBI-style warnings on physical media. Those banners faded from the art. The chill did not disappear — it moved. Pressure still arrives from unexpected places: ISP actions, platform bans, soft legal fear. Trend lines can look better while the settled date when editing old favorites and sharing them with friends is treated as normal stays far away.

Progress is real. It is also slow. We are not there yet.

## Fanedit venues

Existing fanedit communities set useful ownership norms. They also feel deeply compromised — a **controlled opposition** form of the scene, where industry fear manages the outlet. Quality and dissent get filtered. Serious posts can be banned almost immediately even when the editor owns the original and follows posted rules. The author of this repository is banned from those venues; they are not open to people trying to stand out with serious material.

Historic leaders have described controlled opposition as a containment strategy. Applied to culture, it means a permitted sandbox that never approaches the full potential of owned-media remix. We have not begun even **1%** of that potential.

## Pushback by doing the work

Flashback Repository is pushback under ownership rules: make the cut, document it, host it (primarily over IPFS), require that viewers own the commercial original. Watch on the web or via the Android / TV app. No pirate archive. No apology for wanting better versions of films we already bought.

Projects stay in **Kdenlive + melt** so the library remains editable with open-source tools — see [Submissions](/submit).

## Why MP4 (and external subtitles), not MKV

We publish finished cuts as **HEVC MP4** with **sidecar subtitle files**, not as Matroska (`.mkv`).

### Navigating the standards maze

Getting from “I own the film and I made a better cut” to “a friend can press Play in a browser” is not a single button. It is a maze of containers, codecs, licenses, and `canPlayType` answers that differ by OS and hardware.

You would expect that maze to have thinned out by now. For a small library that just wants to host owned edits over IPFS, the path still feels deliberately hard:

- **Matroska (`.mkv`)** is what editors actually finish in. Browsers never made full Matroska a first-class `<video>` format. The web settled on **ISO BMFF / MP4** for progressive and Range streaming, and on **WebM** as a Matroska-derived profile for royalty-sensitive codecs — not “open the `.mkv` and play.”
- **HEVC / H.265** is the efficient codec many of our finals already use. Safari often plays it. Chrome and Firefox only sometimes do — often only when the OS exposes a hardware decoder. On many Linux desktops, Chrome reports **no HEVC at all**, so in-page play fails even when the file is fine. Download + VLC still works because VLC brings its own decoders.
- **H.264** is the universal web fallback, but encoding a second full ladder is days of CPU and a second archive of the same cut. Big platforms absorb that cost as a matter of course.
- **VP9 / AV1** power most of YouTube’s browser delivery — adaptive ladders, royalty-friendlier for the open web — built for fleets that re-encode everything continuously. That is not a weekend workflow for a personal catalog of finished fan edits.

So the maze is not “video is hard.” It is that **easy universal in-browser play** was standardized around stacks and budgets that suit the largest distributors. Independents who already own the discs and just want to share a cleaner cut keep hitting container walls, codec walls, and silent empty strings from `canPlayType`.

It can feel like the only way the incumbents could keep the open web from competing with their players: not a ban on the word *Matroska* or *HEVC*, but a thicket of defaults where “ship one file and Play works everywhere” never quite arrives.

We navigated it anyway, toward a start:

1. Remux the finished edit into a **single fragmented HEVC MP4** (same picture, streamable with HTTP `Range`).
2. Drop published final MKVs from the play path.
3. Keep **external** default (and enhanced) subtitles beside the file.
4. Theater plays where the browser reports HEVC; otherwise say so clearly and point at **Download** for VLC — no endless Buffering.

The name *Matroska* nods at Russian nesting dolls (*matryoshka*). The practical barrier is standardization and product incentives, not a formal ban on the word.

Sidecar subs travel next to the file so the site player and offline apps can find them without relying on a muxed Matroska track browsers ignore.

The allowed part is the point. The rest is craft — and refusing to wait for the maze to become optional.
