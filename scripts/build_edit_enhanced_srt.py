#!/usr/bin/env python3
"""Build FanMix enhanced SRT: cut-timeline dialogue + [Edit:] cards from CHANGES/README.

CHANGES hole times are source times. Cards are placed on the cut timeline:
  cut_t = source_t - sum(dur of holes that end at or before source_t)

Usage:
  python3 scripts/build_edit_enhanced_srt.py --project "FanMixes/Tron Legacy (2010) - The Miracle"
  python3 scripts/build_edit_enhanced_srt.py --project "…" --dry-run
  python3 scripts/build_edit_enhanced_srt.py --all-ready
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAD = 0.40
MIN_CARD = 2.40
MIN_NOTICE = 1.50  # one-line [Edit:] can be shorter when the join is tight
MAX_SPILL = 3  # follow-up cards after the one-line Edit notice (total up to 4)
MAX_CARD_CHARS = 220
MAX_JOIN_SLIDE = 8.0  # don't push Edit notices farther than this from the join

READY_REL = [
    "FanMixes/Terminator 3 (2003) - Brass Monkey",
    "FanMixes/Tron Legacy (2010) - The Miracle",
    "FanMixes/American Psycho (2000) - Psychosomatic",
    "FanMixes/Serenity (2005) - Unjossed",
    "FanMixes/Fried Green Tomatoes (1991) - No Frank Bennett",
    "FanMixes/Fear and Loathing in Las Vegas (1998) - No North Star",
    "FanMixes/Boogie Nights (1997) - The Dream",
    "FanMixes/The Mummy (1999) - Debugged",
]

HOLE_HDR = re.compile(
    r"^###\s+(\d+)\.\s+"
    r"(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?\s*[–—-]\s*"
    r"(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?"
    r"(?:\s*\([^)]*\))?",  # optional (7.9s) / (~2.3 min) on header line
    re.MULTILINE,
)
TS = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})[,.](\d{3})"
)
TBD_MARKERS = (
    "tbd",
    "confirm on picture",
    "no srt overlap",
    "silent pad",
    "silent snip",
    "needs theatrical",
    "scene labels tbd",
)


def to_s(h: int, m: int, s: int, ms: int = 0) -> float:
    return h * 3600 + m * 60 + s + ms / 1000.0


def parse_ms(raw: str | None) -> int:
    if not raw:
        return 0
    return int((raw + "000")[:3])


def fmt(t: float) -> str:
    if t < 0:
        t = 0.0
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    raw = path.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n")
    blocks = re.split(r"\n\s*\n", raw.strip())
    out: list[tuple[float, float, str]] = []
    for block in blocks:
        lines = [ln for ln in block.split("\n") if ln.strip() != ""]
        if len(lines) < 2:
            continue
        joined = "\n".join(lines)
        m = TS.search(joined)
        if not m:
            continue
        text_start = joined.find(m.group(0)) + len(m.group(0))
        text = joined[text_start:].strip()
        if not text or text.startswith("Created and Encoded by"):
            continue
        a = to_s(int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)))
        b = to_s(int(m.group(5)), int(m.group(6)), int(m.group(7)), int(m.group(8)))
        out.append((a, b, text))
    out.sort(key=lambda x: x[0])
    return out


def write_srt(path: Path, cues: list[tuple[float, float, str]]) -> None:
    lines: list[str] = []
    for i, (a, b, text) in enumerate(cues, 1):
        lines.append(f"{i}\n{fmt(a)} --> {fmt(b)}\n{text}\n")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_vtt(path: Path, cues: list[tuple[float, float, str]]) -> None:
    def vfmt(t: float) -> str:
        return fmt(t).replace(",", ".")

    lines = ["WEBVTT", ""]
    for a, b, text in cues:
        lines.append(f"{vfmt(a)} --> {vfmt(b)}")
        lines.append(text)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def gaps(cues: list[tuple[float, float, str]], film_end: float) -> list[tuple[float, float]]:
    g: list[tuple[float, float]] = []
    t = 0.0
    for a, b, _ in cues:
        if a - t > PAD * 2 + MIN_CARD:
            g.append((t + PAD, a - PAD))
        t = max(t, b)
    if film_end - t > PAD * 2 + MIN_CARD:
        g.append((t + PAD, film_end - 0.05))
    return g


def place(
    glist: list[tuple[float, float]],
    prefer: float,
    dur: float,
    *,
    min_dur: float = MIN_CARD,
    max_slide: float | None = None,
) -> tuple[float, float] | None:
    """Place a card near prefer. Optionally refuse gaps farther than max_slide."""
    best = None
    best_d = 1e9
    for a, b in glist:
        if b - a < min_dur:
            continue
        # Prefer starting at prefer when the gap covers it
        if a <= prefer < b:
            start = prefer
        elif prefer < a:
            start = a
        else:
            continue
        if start >= b:
            continue
        use = min(dur, b - start)
        if use < min_dur:
            continue
        d = abs(start - prefer)
        if max_slide is not None and d > max_slide:
            continue
        if d < best_d:
            best_d = d
            best = (start, start + use)
    return best


def slot_free(
    cards: list[tuple[float, float, str]], start: float, end: float, eps: float = 0.02
) -> bool:
    for a, b, _ in cards:
        if end > a + eps and start < b - eps:
            return False
    return True


def force_notice_at_join(
    dialogue: list[tuple[float, float, str]],
    cards: list[tuple[float, float, str]],
    prefer: float,
    dur: float = MIN_NOTICE,
) -> tuple[float, float] | None:
    """Park a short notice at the join; enhanced track will yield dialogue under it."""
    # Try: right after covering cue, then at prefer itself
    cover_end = None
    for a, b, _ in dialogue:
        if a <= prefer < b:
            cover_end = b
            break
    candidates = []
    if cover_end is not None:
        candidates.append(cover_end + 0.05)
    candidates.append(prefer)
    for start in candidates:
        end = start + dur
        # Clamp to next dialogue start if that would leave a readable card
        for a, b, _ in dialogue:
            if a > start + 0.2:
                if a - start >= 1.0:
                    end = min(end, a - 0.05)
                break
        if end - start < 1.0:
            continue
        if slot_free(cards, start, end):
            return start, end
    return None


def consume(
    glist: list[tuple[float, float]], start: float, end: float
) -> list[tuple[float, float]]:
    nxt: list[tuple[float, float]] = []
    for a, b in glist:
        if end <= a or start >= b:
            nxt.append((a, b))
            continue
        if start - a >= MIN_CARD:
            nxt.append((a, start))
        if b - end >= MIN_CARD:
            nxt.append((end, b))
    return nxt


def _is_card(text: str) -> bool:
    t = text.strip()
    return t.startswith("[") and (t.startswith("[Edit:") or t.endswith("]"))


def repair_overlaps(
    cues: list[tuple[float, float, str]], eps: float = 0.02
) -> list[tuple[float, float, str]]:
    """Snap overlaps. Edit/citation cards win over dialogue; cards trim each other."""
    if not cues:
        return []
    out: list[tuple[float, float, str]] = []
    for a, b, t in sorted(cues, key=lambda x: (x[0], x[1])):
        if b <= a:
            continue
        while out and a < out[-1][1] - eps:
            prev_a, prev_b, prev_t = out[-1]
            prev_card, cur_card = _is_card(prev_t), _is_card(t)
            if prev_card and cur_card:
                # Trim earlier card; drop it if too short
                if a - prev_a >= 1.0:
                    out[-1] = (prev_a, a, prev_t)
                else:
                    out.pop()
                continue
            if cur_card and not prev_card:
                # Card wins: trim dialogue end
                if a - prev_a >= 0.3:
                    out[-1] = (prev_a, a, prev_t)
                else:
                    out.pop()
                continue
            if prev_card and not cur_card:
                # Card already placed: start dialogue after it
                a = prev_b
                if b <= a + eps:
                    a = b  # mark drop
                break
            # Dialogue-vs-dialogue
            if a > prev_a + 0.15:
                out[-1] = (prev_a, a, prev_t)
            else:
                if b <= prev_b:
                    a = b  # drop nested
                else:
                    a = prev_b
            break
        if b <= a + eps:
            continue
        out.append((a, b, t))
    return out


class Hole:
    def __init__(
        self, n: int, start: float, end: float, title: str, body: str, skipped: bool
    ):
        self.n = n
        self.start = start
        self.end = end
        self.title = title
        self.body = body
        self.skipped = skipped

    @property
    def dur(self) -> float:
        return max(0.0, self.end - self.start)


def _clean_title(line: str) -> str:
    t = line.strip()
    if t.startswith("- "):
        t = t[2:].strip()
    # **Scene:** description  /  **Title** (notes) — rest
    m = re.match(r"^\*\*([^*]+)\*\*\s*:?\s*(.*)$", t)
    if m:
        label, rest = m.group(1).strip().rstrip(":").strip(), m.group(2).strip()
        lab = label.lower()
        if lab in ("scene", "intent", "join", "removed") and rest:
            t = rest
            t = re.sub(r"\s*Violence\.?\s*$", "", t, flags=re.I)
        elif lab.startswith("removed") and rest:
            # **Removed (…):** **Homeless Al murder** — …
            bm = re.match(r"^\*\*([^*]+)\*\*", rest)
            t = bm.group(1).strip() if bm else rest
        else:
            t = label
        if " — " in t:
            t = t.split(" — ", 1)[0].strip()
    else:
        t = re.sub(r"^\*\*([^*]+)\*\*", r"\1", t)
        t = t.strip("* ").strip()
        if " — " in t:
            t = t.split(" — ", 1)[0].strip()
    # Drop short parenthetical notes on the notice line
    t = re.sub(
        r"\s*\((?:~?[\d.]+s|~?[\d.]+ min|violence|partial)[^)]*\)\s*$",
        "",
        t,
        flags=re.I,
    )
    t = re.sub(r"\*\*", "", t)
    t = re.sub(r"\s+", " ", t).strip().rstrip(".")
    # Prefer the first clause when Scene lines stack notes
    if len(t) > 90 and ". " in t:
        t = t.split(". ", 1)[0].strip()
    return t[:120]


_KNOWN_FIELDS = frozenset({"scene", "intent", "join", "removed"})


def _field_label(line: str) -> str | None:
    """Return Scene/Join/Intent/Removed if line is a labeled bullet."""
    s = line.strip()
    if s.startswith("- "):
        s = s[2:].strip()
    m = re.match(r"^\*\*([^*]+)\*\*", s)
    if not m:
        return None
    lab = m.group(1).strip().rstrip(":").strip().lower().split()[0]
    return lab if lab in _KNOWN_FIELDS else None


def _is_tbd(text: str) -> bool:
    low = text.lower()
    return any(m in low for m in TBD_MARKERS)


def parse_changes(path: Path) -> list[Hole]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    matches = list(HOLE_HDR.finditer(raw))
    holes: list[Hole] = []
    for i, m in enumerate(matches):
        n = int(m.group(1))
        start = to_s(int(m.group(2)), int(m.group(3)), int(m.group(4)), parse_ms(m.group(5)))
        end = to_s(int(m.group(6)), int(m.group(7)), int(m.group(8)), parse_ms(m.group(9)))
        block_end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        block = raw[m.end() : block_end].strip()
        # Title + body: prefer Scene / Removed name over Join geometry
        title = f"Cut {n}"
        body_lines: list[str] = []
        scene_title = None
        removed_title = None
        join_title = None
        skip_removed_block = False
        for ln in block.splitlines():
            s = ln.strip()
            if not s:
                continue
            if s.startswith("#"):
                break
            if re.fullmatch(r"\([^)]*\)", s):
                continue
            field = _field_label(s)
            # Skip Removed-subtitle dump sections (and their indented children)
            if field == "removed" or s.lower().lstrip("- ").startswith("removed subtitle"):
                skip_removed_block = True
                # Still harvest a short **Name** for the Edit card
                if removed_title is None:
                    cand = _clean_title(s)
                    if cand and not cand.lower().startswith("removed"):
                        removed_title = cand
                continue
            if skip_removed_block:
                # Indented continuation of removed-subs list
                if s.startswith("- ") and _field_label(s) in (
                    "scene",
                    "intent",
                    "join",
                ):
                    skip_removed_block = False
                elif s.startswith("- ") or s.startswith("  "):
                    continue
                else:
                    skip_removed_block = False
            if field == "scene":
                scene_title = _clean_title(s)
                # Don't duplicate the Scene text as spill (README fills room)
                continue
            if field == "join":
                join_title = _clean_title(s)
                continue
            if field == "intent":
                rest = re.sub(
                    r"^\*\*[^*]+\*\*\s*:?\s*",
                    "",
                    s[2:].strip() if s.startswith("- ") else s,
                )
                rest = re.sub(r"\*\*", "", rest).strip()
                if rest:
                    body_lines.append(rest)
                continue
            if title == f"Cut {n}" and field is None:
                title = _clean_title(s)
                if " — " in s:
                    rest = s.split(" — ", 1)[1].strip()
                    rest = re.sub(r"\*\*", "", rest).strip()
                    if rest and not rest.lower().startswith("removed"):
                        body_lines.append(rest)
                continue
            # Plain motivation bullets
            raw = s[2:].strip() if s.startswith("- ") else s
            raw = re.sub(r"\*\*", "", raw).strip()
            if raw and not raw.lower().startswith("removed"):
                body_lines.append(raw)
        if scene_title:
            title = scene_title
        elif removed_title and (
            title.startswith("Cut ") or (join_title and title == join_title)
        ):
            title = removed_title
        elif join_title and title.startswith("Cut "):
            title = join_title
        elif join_title and removed_title:
            # Prefer removed beat name over long Join geometry
            title = removed_title
        body = "\n".join(body_lines).strip()
        skipped = False
        if re.search(r"\*\*Scene:\*\*\s*TBD", block, re.I):
            skipped = True
        elif re.search(r"\bTBD\b", title + "\n" + body, re.I) and len(body) < 200:
            skipped = True
        elif _is_tbd(title + "\n" + body) and "snip" not in title.lower():
            # Silent TBD pads without a real label
            if title.startswith("Cut ") or title.lower().startswith("silent"):
                skipped = True
        holes.append(Hole(n, start, end, title, body, skipped))
    return holes


def removed_before(holes: list[Hole], t: float) -> float:
    return sum(h.dur for h in holes if h.end <= t + 1e-6)


def source_to_cut(holes: list[Hole], t: float) -> float:
    return max(0.0, t - removed_before(holes, t))


def cue_in_hole(a: float, b: float, holes: list[Hole]) -> bool:
    mid = (a + b) / 2
    return any(h.start <= mid < h.end for h in holes)


def shift_source_srt_to_cut(
    cues: list[tuple[float, float, str]], holes: list[Hole]
) -> list[tuple[float, float, str]]:
    out: list[tuple[float, float, str]] = []
    for a, b, text in cues:
        if cue_in_hole(a, b, holes):
            continue
        ca = source_to_cut(holes, a)
        cb = source_to_cut(holes, b)
        if cb <= ca:
            continue
        out.append((ca, cb, text))
    out.sort(key=lambda x: x[0])
    return out


def dialogue_is_cut_timed(proj: Path, srt_path: Path, changes_text: str) -> bool:
    """Prefer explicit docs/filename over fragile overlap heuristics."""
    name = srt_path.name.lower()
    if "shifted" in name or "english" in name:
        return True
    low = changes_text.lower()
    if "cut edition" in low or "cut-timed" in low or "cut ≈ source" in low or "cut ≈ source" in changes_text:
        return True
    if "cut-timeline" in low or "timed to the **cut" in low or "timed to the cut" in low:
        return True
    # Tron-style project kdenlive.srt without shifted → source-aligned
    if "kdenlive.srt" in name and "shifted" not in name:
        return False
    # Default: treat as cut edition (most FanMix project SRTs)
    return True


def split_spill(text: str, max_parts: int = MAX_SPILL) -> list[str]:
    """Split motivation into short plain sentences for follow-up cards."""
    # Normalize markdown / list noise
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    t = re.sub(r"\s+", " ", t).strip()
    if not t or t.lower().startswith("removed subtitle"):
        return []
    # Prefer sentence splits (avoid splitting on … or abbreviated quotes mid-card)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"“])", t)
    parts = [
        p.strip()
        for p in parts
        if p.strip()
        and not _is_tbd(p)
        and not p.lower().startswith("removed subtitle")
    ]
    if not parts:
        parts = [t]
    # Chunk long parts
    chunks: list[str] = []
    for p in parts:
        while len(p) > MAX_CARD_CHARS:
            cut = p.rfind(" ", 0, MAX_CARD_CHARS)
            if cut < 40:
                cut = MAX_CARD_CHARS
            chunks.append(p[:cut].strip())
            p = p[cut:].strip()
        if p:
            chunks.append(p)
    return chunks[:max_parts]


def readme_snippets(readme: Path, limit: int = 8) -> list[str]:
    if not readme.is_file():
        return []
    raw = readme.read_text(encoding="utf-8", errors="replace")
    bullets: list[str] = []
    for ln in raw.splitlines():
        s = ln.strip()
        if s.startswith("- ") or s.startswith("* "):
            b = s[2:].strip()
            b = re.sub(r"\*\*([^*]+)\*\*", r"\1", b)
            if len(b) > 20 and not b.lower().startswith("full list"):
                bullets.append(b)
    return bullets[:limit]


def card_texts(hole: Hole, readme_bits: list[str]) -> list[str]:
    title = hole.title or f"Cut {hole.n}"
    cards = [f"[Edit: {title}]"]
    spill_src = hole.body
    # Attach a matching README bullet if it shares a keyword
    stop = {
        "that",
        "this",
        "with",
        "from",
        "after",
        "before",
        "while",
        "scene",
        "still",
        "first",
        "later",
        "whole",
        "mostly",
        "short",
        "here",
    }
    title_keys = [
        w.lower()
        for w in re.findall(r"[A-Za-z]{4,}", title)
        if w.lower() not in stop
    ][:5]
    for b in readme_bits:
        hits = sum(1 for k in title_keys if k in b.lower())
        if hits >= 2 or (hits == 1 and len(title_keys) <= 2):
            spill_src = (spill_src + " " + b).strip()
            break
    for part in split_spill(spill_src):
        # Follow-ups are plain sentences (not another [Edit:] notice)
        cards.append(part if not part.startswith("[") else part)
    return cards[: 1 + MAX_SPILL]


def find_dialogue_srt(proj: Path) -> Path | None:
    subs = proj / "subs"
    if subs.is_dir():
        english = sorted(subs.glob("*.english.srt"))
        if english:
            return english[0]
    # Prefer shifted / cut edition names
    candidates: list[Path] = []
    for p in proj.glob("*.srt"):
        name = p.name.lower()
        if "enhanced" in name or "theatrical" in name:
            continue
        candidates.append(p)
    if not candidates and (proj / "subs").is_dir():
        for p in (proj / "subs").glob("*.srt"):
            name = p.name.lower()
            if "enhanced" in name or "theatrical" in name:
                continue
            candidates.append(p)
    if not candidates:
        return None

    def rank(p: Path) -> tuple[int, str]:
        n = p.name.lower()
        if "shifted" in n:
            return (0, n)
        if p.parent.name == "subs" and "english" in n:
            return (1, n)
        if "kdenlive" in n and "shifted" not in n:
            return (3, n)
        if n.endswith(".srt"):
            return (2, n)
        return (4, n)

    candidates.sort(key=rank)
    return candidates[0]


def stem_for_project(proj: Path) -> str:
    # Prefer edition name without trailing media suffixes
    return proj.name


def load_keep_cards(enhanced: Path) -> list[tuple[float, float, str]]:
    """Keep non-[Edit:] cards from an existing enhanced SRT (investigation tracks)."""
    if not enhanced.is_file():
        return []
    keep: list[tuple[float, float, str]] = []
    for a, b, text in parse_srt(enhanced):
        t = text.strip()
        if t.startswith("[Edit:"):
            continue
        # Drop plain dialogue lines (no brackets) — those come from english
        if not (t.startswith("[") and t.endswith("]")):
            continue
        keep.append((a, b, text))
    return keep


def build_project(proj: Path, dry_run: bool = False) -> int:
    changes = proj / "CHANGES.md"
    if not changes.is_file():
        print(f"SKIP {proj.name}: no CHANGES.md", file=sys.stderr)
        return 1
    holes = parse_changes(changes)
    if not holes:
        print(f"SKIP {proj.name}: no holes parsed", file=sys.stderr)
        return 1
    labeled = [h for h in holes if not h.skipped]
    skipped = [h for h in holes if h.skipped]
    print(
        f"{proj.name}: holes={len(holes)} labeled={len(labeled)} skipped_tbd={len(skipped)}"
    )

    srt_path = find_dialogue_srt(proj)
    if not srt_path:
        print(f"SKIP {proj.name}: no dialogue SRT", file=sys.stderr)
        return 1
    raw_cues = parse_srt(srt_path)
    if not raw_cues:
        print(f"SKIP {proj.name}: empty SRT {srt_path}", file=sys.stderr)
        return 1

    changes_text = changes.read_text(encoding="utf-8", errors="replace")
    cut_timed = dialogue_is_cut_timed(proj, srt_path, changes_text)
    if cut_timed:
        dialogue = raw_cues
        print(f"  dialogue={srt_path.name} (cut-timed) cues={len(dialogue)}")
    else:
        dialogue = shift_source_srt_to_cut(raw_cues, holes)
        print(
            f"  dialogue={srt_path.name} (source→cut) cues={len(raw_cues)}→{len(dialogue)}"
        )

    film_end = dialogue[-1][1] + 30.0 if dialogue else 7200.0
    readme_bits = readme_snippets(proj / "README.md")
    glist = gaps(dialogue, film_end)

    edit_cards: list[tuple[float, float, str]] = []
    placed = 0
    unplaced = 0
    for h in labeled:
        prefer = source_to_cut(holes, h.start)
        texts = card_texts(h, readme_bits)
        for i, text in enumerate(texts):
            slot = None
            if i == 0:
                dur = 3.5
                slot = place(
                    glist, prefer, dur, min_dur=MIN_NOTICE, max_slide=MAX_JOIN_SLIDE
                )
                if slot is None or not slot_free(edit_cards, slot[0], slot[1]):
                    slot = force_notice_at_join(
                        dialogue, edit_cards, prefer, MIN_NOTICE
                    )
            else:
                dur = min(8.0, max(MIN_CARD, len(text) / 28.0))
                slot = place(
                    glist, prefer + 0.1, dur, min_dur=MIN_CARD, max_slide=12.0
                )
                if slot is not None and not slot_free(edit_cards, slot[0], slot[1]):
                    slot = None
            if slot is None:
                if i == 0:
                    unplaced += 1
                break
            a, b = slot
            edit_cards.append((a, b, text))
            glist = consume(glist, a, b)
            prefer = b + 0.05
            placed += 1

    keep = load_keep_cards(proj / "subs" / f"{stem_for_project(proj)}.enhanced.srt")
    # Also check mummy-style stem
    if not keep:
        for p in (proj / "subs").glob("*.enhanced.srt") if (proj / "subs").is_dir() else []:
            keep = load_keep_cards(p)
            break

    if dry_run:
        print(f"  dry-run cards={placed} unplaced_holes={unplaced} keep_cards={len(keep)}")
        for a, b, t in edit_cards[:12]:
            print(f"    {fmt(a)} --> {fmt(b)}  {t[:90]}")
        if len(edit_cards) > 12:
            print(f"    … +{len(edit_cards) - 12} more")
        return 0

    stem = stem_for_project(proj)
    # Prefer existing english stem if present
    existing_en = list((proj / "subs").glob("*.english.srt")) if (proj / "subs").is_dir() else []
    if existing_en:
        stem = existing_en[0].name[: -len(".english.srt")]

    subs = proj / "subs"
    english_path = subs / f"{stem}.english.srt"
    enhanced_path = subs / f"{stem}.enhanced.srt"

    # Strip any accidental Edit cards from dialogue
    clean_dialogue = [
        (a, b, t)
        for a, b, t in dialogue
        if not t.strip().startswith("[Edit:")
    ]
    write_srt(english_path, clean_dialogue)
    write_vtt(subs / f"{stem}.english.vtt", clean_dialogue)

    merged = repair_overlaps(clean_dialogue + keep + edit_cards)
    write_srt(enhanced_path, merged)
    write_vtt(subs / f"{stem}.enhanced.vtt", merged)

    print(
        f"  wrote {english_path.relative_to(ROOT)} cues={len(clean_dialogue)}\n"
        f"  wrote {enhanced_path.relative_to(ROOT)} cues={len(merged)} "
        f"(edit_cards={len(edit_cards)} keep={len(keep)} unplaced={unplaced})"
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--project",
        action="append",
        help="FanMix path relative to repo or absolute (repeatable)",
    )
    ap.add_argument(
        "--all-ready",
        action="store_true",
        help="Build the plan's ready labeled-CHANGES batch",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    paths: list[Path] = []
    if args.all_ready:
        paths.extend(ROOT / rel for rel in READY_REL)
    for p in args.project or []:
        path = Path(p)
        if not path.is_absolute():
            path = ROOT / path
        paths.append(path)
    if not paths:
        ap.error("pass --project and/or --all-ready")
    rc = 0
    for proj in paths:
        if not proj.is_dir():
            print(f"missing {proj}", file=sys.stderr)
            rc = 1
            continue
        try:
            rc = build_project(proj, dry_run=args.dry_run) or rc
        except SystemExit as e:
            print(f"FAIL {proj.name}: {e}", file=sys.stderr)
            rc = 1
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
