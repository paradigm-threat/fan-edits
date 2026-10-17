#!/usr/bin/env python3
"""Convert .srt files under a directory to sibling .vtt (HTML5 <track>)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

TS = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})[,.](\d{3})"
)


def srt_to_vtt_text(raw: str) -> str:
    raw = raw.replace("\r\n", "\n").strip()
    lines = ["WEBVTT", ""]
    for block in re.split(r"\n\s*\n", raw):
        blines = [ln for ln in block.split("\n") if ln.strip() != ""]
        if len(blines) < 2:
            continue
        joined = "\n".join(blines)
        m = TS.search(joined)
        if not m:
            continue
        start = f"{m.group(1)}:{m.group(2)}:{m.group(3)}.{m.group(4)}"
        end = f"{m.group(5)}:{m.group(6)}:{m.group(7)}.{m.group(8)}"
        text = joined[joined.find(m.group(0)) + len(m.group(0)) :].strip()
        if not text:
            continue
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: srt_to_vtt.py <dir-or-srt>...", file=sys.stderr)
        return 2
    for arg in sys.argv[1:]:
        p = Path(arg)
        paths = sorted(p.glob("*.srt")) if p.is_dir() else [p]
        for srt in paths:
            if not srt.is_file() or srt.suffix.lower() != ".srt":
                continue
            vtt = srt.with_suffix(".vtt")
            vtt.write_text(
                srt_to_vtt_text(srt.read_text(encoding="utf-8", errors="replace")),
                encoding="utf-8",
            )
            print(f"wrote {vtt}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
