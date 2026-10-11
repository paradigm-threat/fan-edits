/**
 * Flashback Gmail filter + template creator (DevTools console)
 *
 * HOW TO RUN
 * 1. Open https://mail.google.com (asu account) → Settings → Filters and Blocked Addresses
 * 2. Advanced → Templates → Enable (reload if asked)
 * 3. DevTools → Console → paste this file → Enter
 * 4. Templates first (optional): await FlashbackGmail.createAllTemplates()
 * 5. Filters: stay on #settings/filters, then:
 *      await FlashbackGmail.createAllFilters()
 *
 * Do not click Search. Keep the tab focused.
 *
 * Resume: await FlashbackGmail.createAllFilters({ startAt: N })
 */
(function () {
  'use strict';

  const ITEMS = [{"subject": "Request: Alien Resurrection UnJossed", "templateTitle": "Request: Alien Resurrection (1997) - UnJossed", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1x3d-051h15JqnpIw0mVi1FOdn-tI1h8i?usp=drive_link\">Alien Resurrection (1997) — UnJossed</a></p>\n<h1>Alien Resurrection (1997) — UnJossed</h1>\n<p>A leaner Alien Resurrection that strips out most of the gross, Joss Whedon–flavored body-horror gags while keeping the Betty crew’s escape intact.</p>\n<h2>Changes</h2>\n<ul>\n<li>Removes most gross (Joss Whedon–inspired) sequences, including the birth and death of the hybrid alien.</li>\n</ul>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Congo Incel", "templateTitle": "Request: Congo (1995) - Incel", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1ovdyyfUufyBw-168KbRl9YWMSjDSpxEQ?usp=drive_link\">Congo (1995) — Incel</a></p>\n<h1>Congo (1995) — Incel</h1>\n<p>A leaner Congo that trims Dr. Elliot’s incel-ish dialogue, some Travis/Captain Wanta screaming, and a bit of gore — and fixes a travel plot hole by moving the Bob Driscoll encounter forward.</p>\n<h2>Changes</h2>\n<ul>\n<li>Removes much of Dr. Elliot’s irritating (incel-ish) dialogue.</li>\n<li>Trims some screaming scenes by Travis and Captain Wanta.</li>\n<li>Cuts or reduces some gore.</li>\n<li>Moves the Bob Driscoll forest encounter forward so the group finds him right outside the campsite where he was attacked (instead of days of travel later).</li>\n</ul>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Final Fantasy The Phantom Menace", "templateTitle": "Request: Final Fantasy (2001) - The Phantom Menace", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1kSxirEf2iK2hQWZKVioe61Shup6V99W3?usp=drive_link\">Final Fantasy (2001) — The Phantom Menace</a></p>\n<h1>Final Fantasy (2001) — The Phantom Menace</h1>\n<p>Final Fantasy: The Spirits Within (2001) — Phantom Menace Edition. A minimalist re-cut that strips distracting acting and excess human-behavior beats, shortens gore, and restores a more Final Fantasy–like title placement — with the rare Japanese track and remix soundtrack upgra</p>\n<h2>Changes</h2>\n<ul>\n<li>Removes distracting or poorly acted scenes.</li>\n<li>Includes the rare Japanese track as a 2nd audio option.</li>\n<li>Adds the Final Fantasy remix “A Temple of Chaos” by Tim Sheehy.</li>\n<li>Replaces the credits song Spirit Dreams Inside with the Final Fantasy IV remix “Hymn to the Crystals” by RebeccaETripp.</li>\n<li>Moves the title scene from the first scene to after the intro sequence (more traditional for Final Fantasy stories).</li>\n</ul>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Matrix Reloaded Unlinked", "templateTitle": "Request: Matrix Reloaded (2003) - Unlinked", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1NWQjQyUXL7BBH_v8CcKdRRuJk9LYLOWy?usp=drive_link\">Matrix Reloaded (2003) — Unlinked</a></p>\n<h1>Matrix Reloaded (2003) — Unlinked</h1>\n<p>A pacing-focused cut of The Matrix Reloaded that strips many Link establishment sequences plus a few early-movie wreckers (orgasm-brownie, kiss), so the story moves without the Tank-replacement hand-holding.</p>\n<h2>Changes</h2>\n<ul>\n<li>Removes many Link establishment sequences.</li>\n<li>Removes the orgasm-brownie sequence.</li>\n<li>Removes the kiss sequence.</li>\n<li>Removes a few other early-pacing wreckers.</li>\n</ul>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Matrix Revolutions Unlinked", "templateTitle": "Request: Matrix Revolutions (2003) - Unlinked", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1MZUnqPi7GJFW1Vgmq2aGdLBeb8dYgJ8e?usp=drive_link\">Matrix Revolutions (2003) — Unlinked</a></p>\n<h1>Matrix Revolutions (2003) — Unlinked</h1>\n<p>A companion cut to Reloaded — Unlinked that trims many Link establishment sequences from The Matrix Revolutions.</p>\n<h2>Changes</h2>\n<ul>\n<li>Removes many Link establishment sequences.</li>\n</ul>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Riddick Unjinxed", "templateTitle": "Request: Riddick (2013) - Unjinxed", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1nOE4hEWJmFOhmKRTwdDuL8ecCYXqWUpL?usp=drive_link\">Riddick (2013) — Unjinxed</a></p>\n<h1>Riddick (2013) — Unjinxed</h1>\n<p>A dialogue-trimmed Riddick that keeps the Unjinxed tone, front-loads the Necromonger “wrong planet” flashback as a linear prologue, and drops the opening predator beat so the desert survival story starts clean.</p>\n<h2>Changes</h2>\n<ul>\n<li>Removes distracting, sexist, and exaggerated dialogue throughout (legacy Unjinxed trims in `playlist2`).</li>\n<li>vulture/pterosaur kill — QC refine in Kdenlive</li>\n<li>Vaako / Furya-bait conspiracy — keep removed</li>\n<li>flashback block A — plays in prologue only</li>\n<li>flashback block B — plays in prologue only; main omits 654-1371 except savanna 1371-1443</li>\n</ul>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Silent Hill Nay Tomorrow", "templateTitle": "Request: Silent Hill (2006) - Nay Tomorrow", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1gSDWYYHbyn25NEWnChrtwfpgrmTXrONV?usp=drive_link\">Silent Hill (2006) — Nay Tomorrow Edition</a></p>\n<h1>Silent Hill (2006) — Nay Tomorrow Edition</h1>\n<p>My wife and I love this movie, but it's quite unwatchable in its current format. We wanted a cut that we could watch without having to turn away or fast-forward through sequences.</p>\n<h2>Changes</h2>\n<ul>\n<li>Cuts nearly all gross/gory/sexist sequences.</li>\n<li>Much of Jodelle Ferland’s narration dialog removed, along with poorly acted Alessa sequences.</li>\n<li>Cybil’s death sequence slightly shortened.</li>\n<li>Christabella’s death removed.</li>\n<li>Songs from the Silent Hill 1 PC OST added or replacing original soundtrack audio on some sequences.</li>\n<li>SH1 2002 remix “Nay Tomorrow” by Tamimi used toward the end.</li>\n<li>I use KDENLive for all edits.</li>\n<li>The edit files are available if you'd like to open one of my edits, make changes, or re-render in higher def.</li>\n<li>I tend to cut between scenes on the switching frame, which allows scenes to be stitched together easier by leaving more room on the wings.</li>\n</ul>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Sonic DeSchwartzed", "templateTitle": "Request: Sonic (2020) - DeSchwartzed", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1PJsSUq4MGtTBE5O6y3gUXy2y88YCucXb?usp=drive_link\">Sonic (2020) — DeSchwartzed Edition</a></p>\n<h1>Sonic (2020) — DeSchwartzed Edition</h1>\n<p>The Sonic Movie Trilogy (2020-2024) is quite unwatchable due to decisions by Ben Schwartz and other editors to add distracting, unamusing, racist, and otherwise agenda-driven dialog during</p>\n<h2>Changes</h2>\n<ul>\n<li>Much of Sonic’s sardonic commentary dialogue (voiced by Ben Schwartz) removed.</li>\n<li>Some Knuckles / Tails dialog trimmed.</li>\n<li>Nearly all dialogue and scenes with Wade and Rachel removed.</li>\n<li>Many sappy family scenes removed.</li>\n<li>Predictive-programming beats (e.g. Rachel pushing divorce) removed where not plot-required.</li>\n<li>Credit vocal songs replaced with Sonic game music remixes (four OC ReMixes from the corresponding game).</li>\n</ul>\n<p>Full picture-hole list (many TBD by cue): CHANGES.md.</p>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Sonic 2 DeSchwartzed", "templateTitle": "Request: Sonic 2 (2022) - DeSchwartzed", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1SrXyU9a6IW5aAwTkbuBTzSSCtht2dW1e?usp=drive_link\">Sonic 2 (2022) — DeSchwartzed Edition</a></p>\n<h1>Sonic 2 (2022) — DeSchwartzed Edition</h1>\n<p>The Sonic Movie Trilogy (2020-2024) is quite unwatchable due to decisions by Ben Schwartz and other editors to add distracting, unamusing, racist, and otherwise agenda-driven dialog during</p>\n<h2>Changes</h2>\n<ul>\n<li>Much of Sonic’s sardonic commentary dialogue (voiced by Ben Schwartz) removed.</li>\n<li>Some Knuckles / Tails dialog trimmed.</li>\n<li>Nearly all dialogue and scenes with Wade and Rachel removed.</li>\n<li>Many sappy family scenes removed.</li>\n<li>Predictive-programming beats (e.g. Rachel pushing divorce) removed where not plot-required.</li>\n<li>Credit vocal songs replaced with Sonic game music remixes (four OC ReMixes from the corresponding game).</li>\n</ul>\n<p>Full picture-hole list (no source SRT in project; times only): CHANGES.md.</p>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Sonic 3 DeSchwartzed", "templateTitle": "Request: Sonic 3 (2024) - DeSchwartzed", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1aRNQi_34WDdiffURCSgyRSnYmubNHKax?usp=drive_link\">Sonic 3 (2024) — DeSchwartzed Edition</a></p>\n<h1>Sonic 3 (2024) — DeSchwartzed Edition</h1>\n<p>The Sonic Movie Trilogy (2020-2024) is quite unwatchable due to decisions by Ben Schwartz and other editors to add distracting, unamusing, racist, and otherwise agenda-driven dialog during</p>\n<h2>Changes</h2>\n<ul>\n<li>Much of Sonic’s sardonic commentary dialogue (voiced by Ben Schwartz) removed.</li>\n<li>Some Knuckles / Tails dialog trimmed.</li>\n<li>Nearly all dialogue and scenes with Wade and Rachel removed.</li>\n<li>Many sappy family scenes removed.</li>\n<li>Predictive-programming beats (e.g. Rachel pushing divorce) removed where not plot-required.</li>\n<li>Credit vocal songs replaced with remixes from Sonic 3 and Sonic & Knuckles game music.</li>\n</ul>\n<p>Full picture-hole list (many TBD by cue): CHANGES.md.</p>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Terminator 3 Brass Monkey", "templateTitle": "Request: Terminator 3 (2003) - Brass Monkey", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/12exHsbQHXRGxq4OdXaIGN6bkpxsYsZ3-?usp=drive_link\">Terminator 3 (2003) — Brass Monkey Edition</a></p>\n<h1>Terminator 3 (2003) — Brass Monkey Edition</h1>\n<p>In Brass Monkey Edition, I attempt to cut out all distracting dialog and sequences in Terminator 3 to be more like the first two movies.</p>\n<h2>Changes</h2>\n<ul>\n<li>Nick Stahl removed as much as possible, along with his narration.</li>\n<li>Stripper scene removed.</li>\n<li>Dialog about Kate worrying over her wedding removed.</li>\n<li>Many other distracting or contradictory scenes trimmed — e.g. a trailer-sequence “cash only” sign (phones down) that contradicts the clerk’s police call going through later.</li>\n<li>Background track “Dat Funky Man” replaced with Beastie Boys’ “Brass Monkey” (felt like the original song pick for that scene).</li>\n</ul>\n<p>DM me for a copy of the whole movie. Full picture-hole list (many TBD by cue): CHANGES.md.</p>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: The Chronicles Of Riddick Fry's Edition", "templateTitle": "Request: The Chronicles Of Riddick (2004) - Fry's Edition", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1MVg8HlolJECDWUYY2GdFCL1I1c6oTVfJ?usp=drive_link\">The Chronicles Of Riddick (2004) — Fry's Edition</a></p>\n<h1>The Chronicles Of Riddick (2004) — Fry's Edition</h1>\n<p>This version removes many extended scenes and restores some audio from the Theatrical version. It also removes many poorly acted, sexist, or just irritating scenes with Thandiwe Newton (Dame Vaako) and Alexa Davalos (Kyra).</p>\n<h2>Changes</h2>\n<ul>\n<li>Extended-cut sleaze and generic prophecy/vision sequences trimmed toward a high-def theatrical-leaning pace.</li>\n<li>Some Theatrical-version audio restored where useful.</li>\n<li>Poorly acted, sexist, or irritating Dame Vaako (Thandiwe Newton) sequences removed or reduced so she reads as a bystander.</li>\n<li>Irritating Kyra (Alexa Davalos) scenes trimmed.</li>\n<li>Unproblematic extended sequences left in.</li>\n</ul>\n<p>Full picture-hole list (many TBD by cue): CHANGES.md.</p>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: The Day After Tomorrow Yuppocolypse", "templateTitle": "Request: The Day After Tomorrow (2004) - Yuppocolypse", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1MhZKdLwAEGq_MlQgiaRnMF7nQKBN79V_?usp=drive_link\">The Day After Tomorrow (2004) — Yuppocolypse</a></p>\n<h1>The Day After Tomorrow (2004) — Yuppocolypse</h1>\n<p>A leaner Day After Tomorrow that spends less time establishing the yuppie protagonists before the climate disaster takes over.</p>\n<h2>Changes</h2>\n<ul>\n<li>Removes many establishment scenes for the yuppie protagonists.</li>\n</ul>\n<p>Full hole list with subtitle cues: CHANGES.md.</p>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: War of the Worlds Family Therapy", "templateTitle": "Request: War of the Worlds (2005) - Family Therapy", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1B2ryOWkhDf0Q5pA8BL2PDL2HIIp4TZjD?usp=drive_link\">War of the Worlds (2005) — Family Therapy Edition</a></p>\n<h1>War of the Worlds (2005) — Family Therapy Edition</h1>\n<p>This FanMix eliminates nearly all the toxic family behavior featured in the movie, so that WotW (2005) becomes a movie about aliens and not allusions to Spielberg's trouble raising his own children.</p>\n<h2>Changes</h2>\n<ul>\n<li>Scenes with tense, abrasive, and/or childish family behavior shortened where that behavior isn’t caused by the alien invasion.</li>\n<li>All dialog from Ray’s friends Vincent and Julio arguing about solar flares removed.</li>\n<li>SpongeBob scenes removed.</li>\n<li>Some alien sequences removed (alien death near the end; aliens traveling in lightning).</li>\n<li>Score features music from Jeff Wayne’s War of the Worlds album and the Orson Welles 1938 broadcast.</li>\n<li>Morgan Freeman’s intro replaced by Richard Burton’s.</li>\n</ul>\n<p>Full picture-hole list (many TBD by cue): CHANGES.md.</p>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": false}, {"subject": "Request: Sonic Trilogy DeShwartzed", "templateTitle": "Request: Sonic Trilogy DeSchwartzed", "html": "<div dir=\"ltr\"><div class=\"gmail_quote\">\n<p>Welcome to Ari's Flashback Repository answering machine.</p>\n<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>\n<p><strong>Your download:</strong></p>\n<p><a href=\"https://drive.google.com/drive/folders/1PJsSUq4MGtTBE5O6y3gUXy2y88YCucXb?usp=drive_link\">Sonic (2020) - DeSchwartzed</a></p>\n<p><a href=\"https://drive.google.com/file/d/1NPS1_HiXhVWQaEf-ak4mKxQuhJLqo5VX/view?usp=drive_link\">Sonic 2 (2022) - DeSchwartzed</a></p>\n<p><a href=\"https://drive.google.com/file/d/1NAxJuiGNn0xniHzR_CqhBaPQOAKlbQZ7/view?usp=drive_link\">Sonic 3 (2024) - DeSchwartzed</a></p>\n<h1>Sonic (2020) — DeSchwartzed Edition</h1>\n<h2>Changes</h2>\n<ul>\n<li>Much of Sonic’s sardonic commentary dialogue (voiced by Ben Schwartz) removed.</li>\n<li>Some Knuckles / Tails dialog trimmed.</li>\n<li>Nearly all dialogue and scenes with Wade and Rachel removed.</li>\n<li>Many sappy family scenes removed.</li>\n<li>Predictive-programming beats (e.g. Rachel pushing divorce) removed where not plot-required.</li>\n<li>Credit vocal songs replaced with Sonic game music remixes (four OC ReMixes from the corresponding game).</li>\n</ul>\n<p>Full picture-hole list (many TBD by cue): CHANGES.md.</p>\n<h2>Flashback Repository</h2>\n<p><a href=\"https://flashbackrepository.org/\">Library / Now Showing</a> — stream seeded titles in VLC</p>\n<p><a href=\"https://flashbackrepository.org/request\">Request any title</a> — email form with the correct subject line</p>\n<p><a href=\"https://flashbackrepository.org/motivation\">Why we're doing this</a> — ownership, craft, and culture</p>\n<p><a href=\"https://flashbackrepository.org/setup\">Setup for playback</a> — VLC / vlc:// one-click</p>\n<h2>Additional links</h2>\n<p><a href=\"https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link\">All of my FanEdit downloads</a> (Google Drive)</p>\n<p><a href=\"https://gitlab.com/clevertree/fan-edits\">Source READMEs and project files on GitLab</a></p>\n<p>Thanks for watching — feedback welcome on the <a href=\"https://flashbackrepository.org/board\">Board</a>.</p>\n<p>-Ari</p>\n</div></div>", "markAsRead": true}];

  const FILTERS_HASH = '#settings/filters';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function visible(el) {
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function textOf(el) {
    return (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  function findByText(sel, text, root) {
    const t = (text || '').trim().toLowerCase();
    return qsa(sel, root).find((el) => visible(el) && textOf(el).toLowerCase().includes(t));
  }

  function findExactText(sel, text, root) {
    const t = (text || '').trim().toLowerCase();
    return qsa(sel, root).find((el) => visible(el) && textOf(el).toLowerCase() === t);
  }

  async function clickEl(el, label) {
    if (!el) throw new Error('Missing element: ' + label);
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.focus?.();
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    if (typeof el.click === 'function') el.click();
    await sleep(350);
  }

  async function waitFor(fn, timeoutMs, label) {
    const end = Date.now() + (timeoutMs || 15000);
    let last;
    while (Date.now() < end) {
      last = fn();
      if (last) return last;
      await sleep(150);
    }
    throw new Error('Timeout waiting for ' + (label || 'condition'));
  }

  async function ensureFiltersSettings() {
    if (!/#settings\/filters/i.test(location.hash)) {
      console.log('Navigating back to', FILTERS_HASH);
      location.hash = FILTERS_HASH;
      await sleep(900);
      await waitFor(
        () => findByText('span.sA, span[role="link"], a', 'Create a new filter'),
        12000,
        'Create a new filter link',
      );
    }
  }

  function filterCriteriaDialog() {
    // Criteria popup: has Subject label + Create filter button
    return (
      qsa('.SK.ZF-zT, .ZZ, [role="dialog"]').find(
        (d) => visible(d) && /subject/i.test(textOf(d)) && /create filter/i.test(textOf(d)),
      ) || null
    );
  }

  function subjectInput() {
    const dialog = filterCriteriaDialog() || document;
    const labeled = qsa('label', dialog).find((l) => /^subject$/i.test(textOf(l)));
    if (labeled) {
      const id = labeled.getAttribute('for');
      if (id) {
        const byId = document.getElementById(id);
        if (byId && visible(byId)) return byId;
      }
    }
    return (
      qsa('input.aQd', dialog).find(visible) ||
      document.querySelector('input.aQd') ||
      null
    );
  }

  function createFilterCriteriaButton() {
    const dialog = filterCriteriaDialog() || document;
    // Prefer Material button with aria-label; never the Search / Test search button
    const byAria = qsa('button[aria-label="Create filter"]', dialog).find(
      (b) => visible(b) && !b.disabled && !b.hasAttribute('disabled'),
    );
    if (byAria) return byAria;
    // Fallback: exact text, exclude Search
    return qsa('button', dialog).find(
      (b) =>
        visible(b) &&
        !b.disabled &&
        !b.hasAttribute('disabled') &&
        /^create filter$/i.test(textOf(b)) &&
        !/search/i.test(b.getAttribute('aria-label') || ''),
    );
  }

  /** Type so Closure/Gmail model sees the value (plain .value= leaves subject empty in hash). */
  async function typeInto(el, value) {
    if (!el) throw new Error('Missing input');
    el.focus();
    await sleep(80);
    // Clear
    el.select?.();
    const okInsert = document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, '');
    if (!okInsert || el.value) {
      el.value = '';
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
    await sleep(50);
    // Preferred: insertText (updates Gmail bindings)
    el.focus();
    const inserted = document.execCommand('insertText', false, value);
    if (!inserted || el.value !== value) {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      // Fallback key events for listeners that ignore input
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a', code: 'KeyA' }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a', code: 'KeyA' }));
    }
    await sleep(250);
    if ((el.value || '').trim() !== value.trim()) {
      throw new Error('Subject input did not stick (got: ' + JSON.stringify(el.value) + ')');
    }
  }

  async function dismissStrayDialogs() {
    // Esc any open overlay that isn't our criteria form
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(200);
    }
  }

  async function openCreateFilterDialog() {
    await ensureFiltersSettings();
    if (subjectInput()) return;
    await dismissStrayDialogs();
    await ensureFiltersSettings();
    const link =
      findExactText('span.sA, span[role="link"]', 'Create a new filter') ||
      findByText('span.sA, span[role="link"], a', 'Create a new filter');
    if (!link) throw new Error('Create a new filter link not found — open #settings/filters');
    await clickEl(link, 'Create a new filter');
    await waitFor(() => subjectInput(), 12000, 'subject input in criteria dialog');
  }

  function actionsDialogReady() {
    // Step 2: action checkboxes (Send template / Skip Inbox / Also apply…)
    return (
      findByText('label', 'Send template') ||
      findByText('label', 'Mark as read') ||
      findByText('label', 'Skip the Inbox') ||
      findByText('div, span, label', 'When a message arrives that matches this search') ||
      findByText('button, span', 'Also apply filter to matching conversations')
    );
  }

  async function goCreateFilterStep2() {
    const btn = await waitFor(() => createFilterCriteriaButton(), 10000, 'enabled Create filter button');
    // Guard: never click Search
    if (/search/i.test(btn.getAttribute('aria-label') || '') || /^search$/i.test(textOf(btn))) {
      throw new Error('Refusing to click Search — would leave filter settings');
    }
    const beforeHash = location.hash;
    await clickEl(btn, 'Create filter (criteria → actions)');
    try {
      await waitFor(() => actionsDialogReady(), 15000, 'filter actions dialog');
    } catch (e) {
      // If Gmail dumped us on #create-filter with empty/wrong subject, recover
      console.warn('Actions dialog missing. hash=', location.hash, 'prev=', beforeHash);
      throw e;
    }
  }

  async function checkAction(labelText) {
    const lab = findByText('label', labelText);
    if (!lab) return false;
    const forId = lab.getAttribute('for');
    let input = forId ? document.getElementById(forId) : null;
    if (!input) input = lab.querySelector('input[type="checkbox"]');
    if (input) {
      if (!input.checked) await clickEl(input, labelText + ' checkbox');
      return true;
    }
    await clickEl(lab, labelText);
    return true;
  }

  async function pickTemplate(templateTitle) {
    await sleep(400);
    const selects = qsa('select').filter(visible);
    for (const sel of selects) {
      const opts = Array.from(sel.options || []);
      const match = opts.find((o) => textOf(o) === templateTitle) ||
        opts.find((o) => textOf(o).includes(templateTitle));
      if (match) {
        sel.value = match.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(200);
        return true;
      }
    }
    const listbox = qsa('[role="listbox"]').find(visible);
    if (listbox) {
      await clickEl(listbox, 'template listbox');
      await sleep(350);
      const opt =
        findExactText('[role="option"], .J-N', templateTitle) ||
        findByText('[role="option"], .J-N', templateTitle);
      if (opt) {
        await clickEl(opt, 'template option');
        return true;
      }
    }
    // Gmail sometimes uses a dropdown button near Send template
    const near = findByText('label', 'Send template');
    if (near) {
      const row = near.closest('tr, div') || near.parentElement;
      const dd = row && qsa('[role="listbox"], .J-JN-M-I, select', row).find(visible);
      if (dd) {
        await clickEl(dd, 'template dropdown');
        await sleep(350);
        const opt =
          findExactText('[role="option"], .J-N', templateTitle) ||
          findByText('[role="option"], .J-N', templateTitle);
        if (opt) {
          await clickEl(opt, 'template option');
          return true;
        }
      }
    }
    console.warn('Could not auto-select template; choose manually:', templateTitle);
    return false;
  }

  async function confirmCreateFilter() {
    const candidates = qsa('button, div[role="button"], span[role="button"]').filter(
      (el) => visible(el) && /^create filter$/i.test(textOf(el)) && !el.disabled,
    );
    const el = candidates[candidates.length - 1];
    if (!el) throw new Error('Confirm Create filter button not found');
    await clickEl(el, 'confirm Create filter');
    await sleep(1400);
  }

  async function createOneFilter(item) {
    console.log('Filter:', item.subject);
    await ensureFiltersSettings();
    await openCreateFilterDialog();
    const subj = subjectInput();
    await typeInto(subj, item.subject);
    // Wait until Gmail enables Create filter (proves model has criteria)
    await waitFor(() => createFilterCriteriaButton(), 10000, 'Create filter enabled after subject');
    await goCreateFilterStep2();
    if (item.markAsRead) await checkAction('Mark as read');
    const ok = await checkAction('Send template');
    if (!ok) throw new Error('Send template checkbox not found — enable Templates under Advanced');
    await pickTemplate(item.templateTitle);
    await confirmCreateFilter();
    await ensureFiltersSettings();
    console.log('✓ filter created for', item.subject);
  }

  // ---- Templates via Compose ----
  async function openCompose() {
    const btn =
      findByText('div[role="button"], button', 'Compose') ||
      document.querySelector('.T-I.T-I-KE');
    await clickEl(btn, 'Compose');
    await waitFor(
      () => document.querySelector('[role="textbox"][contenteditable="true"], div.Am.Al.editable'),
      10000,
      'compose body',
    );
  }

  async function setComposeBodyHtml(html) {
    const box =
      document.querySelector('[aria-label="Message Body"][contenteditable="true"]') ||
      document.querySelector('div[role="textbox"][contenteditable="true"]') ||
      document.querySelector('div.Am.Al.editable');
    if (!box) throw new Error('Compose body not found');
    box.focus();
    box.innerHTML = html;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(400);
  }

  async function saveAsTemplate(templateTitle) {
    const more =
      document.querySelector('div[aria-label="More options"], div[data-tooltip="More options"]') ||
      findByText('div[role="button"]', 'More options');
    if (more) await clickEl(more, 'More options');
    await sleep(400);
    const templatesMenu =
      findByText('div[role="menuitem"], span', 'Templates') ||
      findByText('div[role="menuitem"]', 'Canned responses');
    if (!templatesMenu) {
      throw new Error('Templates menu not found. Enable Settings → Advanced → Templates → Enable');
    }
    await clickEl(templatesMenu, 'Templates');
    await sleep(400);
    const saveNew =
      findByText('div[role="menuitem"], span', 'Save draft as template') ||
      findByText('div[role="menuitem"]', 'Save as template');
    if (saveNew) await clickEl(saveNew, 'Save draft as template');
    await sleep(300);
    const saveAsNew =
      findByText('div[role="menuitem"], span', 'Save as new template') ||
      findByText('div[role="menuitem"]', 'Save as New Template');
    if (saveAsNew) await clickEl(saveAsNew, 'Save as new template');
    await sleep(500);
    const dialogInput = qsa('input[type="text"]').filter(visible).pop();
    await typeInto(dialogInput, templateTitle);
    const saveBtn =
      findExactText('button, span[role="button"], div[role="button"]', 'Save') ||
      findByText('button', 'Save');
    await clickEl(saveBtn, 'Save template');
    await sleep(1000);
    const discard =
      document.querySelector('div[aria-label="Discard draft"], img[aria-label="Discard draft"]') ||
      findByText('div[role="button"]', 'Discard');
    if (discard) await clickEl(discard, 'Discard draft');
    await sleep(400);
    const okDiscard = findByText('button, span[role="button"]', 'OK') || findByText('button', 'Discard');
    if (okDiscard && visible(okDiscard)) await clickEl(okDiscard, 'confirm discard');
    await sleep(600);
  }

  async function createOneTemplate(item) {
    console.log('Template:', item.templateTitle);
    await openCompose();
    await setComposeBodyHtml(item.html);
    await saveAsTemplate(item.templateTitle);
    console.log('✓ template saved', item.templateTitle);
  }

  async function createAllTemplates(opts) {
    const startAt = (opts && opts.startAt) || 0;
    for (let i = startAt; i < ITEMS.length; i++) {
      console.log(`[template ${i + 1}/${ITEMS.length}]`);
      try {
        await createOneTemplate(ITEMS[i]);
      } catch (e) {
        console.error('Failed at template index', i, ITEMS[i].templateTitle, e);
        console.log('Resume with: await FlashbackGmail.createAllTemplates({ startAt: ' + i + ' })');
        throw e;
      }
    }
  }

  async function createAllFilters(opts) {
    const startAt = (opts && opts.startAt) || 0;
    await ensureFiltersSettings();
    for (let i = startAt; i < ITEMS.length; i++) {
      console.log(`[filter ${i + 1}/${ITEMS.length}]`);
      try {
        await createOneFilter(ITEMS[i]);
      } catch (e) {
        console.error('Failed at filter index', i, ITEMS[i].subject, e);
        console.log('hash now:', location.hash);
        console.log('Resume: location.hash="#settings/filters"; await FlashbackGmail.createAllFilters({ startAt: ' + i + ' })');
        throw e;
      }
    }
  }

  async function setupAll(opts) {
    opts = opts || {};
    console.log('FlashbackGmail: ' + ITEMS.length + ' titles');
    if (!opts.filtersOnly) {
      await createAllTemplates({ startAt: opts.startAt || 0 });
    }
    if (!opts.templatesOnly) {
      await ensureFiltersSettings();
      await createAllFilters({ startAt: opts.filtersOnly ? opts.startAt || 0 : 0 });
    }
    console.log('Done.');
  }

  window.FlashbackGmail = {
    ITEMS,
    setupAll,
    createAllTemplates,
    createAllFilters,
    createOneFilter,
    createOneTemplate,
    ensureFiltersSettings,
  };

  console.log(
    '%cFlashbackGmail ready%c — on #settings/filters run: await FlashbackGmail.createAllFilters()',
    'color:#c9a227;font-weight:bold',
    'color:inherit',
  );
  console.log('Templates first if needed: await FlashbackGmail.createAllTemplates()');
})();
