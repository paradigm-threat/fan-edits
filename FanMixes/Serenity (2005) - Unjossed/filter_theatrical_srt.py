#!/usr/bin/env python3
"""Drop DVD commentary cues from OCR'd SRT; keep theatrical dialogue."""
from __future__ import annotations

import re
import sys
from pathlib import Path

COMMENTARY_MARKERS = re.compile(
    r"(?i)\b("
    r"WHEDON:|BALDWIN:|FILLION:|GLEASON:|MAHER:|NEWTON:|TORRES:|"
    r"commentary track|making of|on this commentary|recommend that you turn it off"
    r")\b"
)
ACTOR_ITALIC = re.compile(r"^\s*<i>\s*[A-Z][A-Z\s]+:\s", re.MULTILINE)


def is_commentary_block(text: str) -> bool:
    if COMMENTARY_MARKERS.search(text):
        return True
    if ACTOR_ITALIC.search(text) and "<i>" in text:
        plain = re.sub(r"<[^>]+>", "", text).strip()
        if len(plain) > 60 and text.strip().startswith("<i>"):
            return True
    return False


def filter_srt(inp: Path, out: Path) -> int:
    raw = inp.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"\n\s*\n", raw.strip())
    kept: list[str] = []
    dropped = 0
    for block in blocks:
        lines = block.strip().splitlines()
        if len(lines) < 2:
            continue
        body = "\n".join(lines[2:]) if re.match(r"^\d+$", lines[0].strip()) else "\n".join(lines[1:])
        if is_commentary_block(body):
            dropped += 1
            continue
        kept.append(block.strip())
    out.write_text("\n\n".join(kept) + "\n", encoding="utf-8")
    return dropped


if __name__ == "__main__":
    here = Path(__file__).resolve().parent
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else here / "eng_dvd.eng.srt"
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else here / "Serenity.en.srt"
    n = filter_srt(src, dst)
    print(f"Wrote {dst} (dropped {n} commentary cues)", file=sys.stderr)
