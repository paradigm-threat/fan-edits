#!/usr/bin/env python3
"""Convert SubRip (.srt) to WebVTT (.vtt) for HTML5 <track> playback."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

TS_ARROW = re.compile(
    r"^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})"
)


def _to_vtt_ts(ts: str) -> str:
    ts = ts.replace(",", ".")
    # Normalize fractional seconds to 3 digits
    if "." in ts:
        head, frac = ts.rsplit(".", 1)
        frac = (frac + "000")[:3]
        return f"{head}.{frac}"
    return ts + ".000"


def srt_text_to_vtt(text: str) -> str:
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out: list[str] = ["WEBVTT", ""]
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        # Optional cue index
        if line.isdigit():
            i += 1
            if i >= n:
                break
            line = lines[i].strip()
        m = TS_ARROW.match(line)
        if not m:
            i += 1
            continue
        start = _to_vtt_ts(m.group(1))
        end = _to_vtt_ts(m.group(2))
        out.append(f"{start} --> {end}")
        i += 1
        while i < n and lines[i].strip():
            out.append(lines[i].rstrip())
            i += 1
        out.append("")
        i += 1
    if out[-1] != "":
        out.append("")
    return "\n".join(out)


def convert_file(src: Path, dest: Path | None = None, *, force: bool = False) -> Path:
    dest = dest or src.with_suffix(".vtt")
    if dest.is_file() and not force:
        if dest.stat().st_mtime >= src.stat().st_mtime:
            return dest
    text = src.read_text(encoding="utf-8", errors="replace")
    dest.write_text(srt_text_to_vtt(text), encoding="utf-8")
    return dest


def convert_tree(root: Path, *, force: bool = False) -> list[Path]:
    written: list[Path] = []
    for srt in sorted(root.rglob("*.srt")):
        # Prefer project subs/ dirs; still convert any .srt under root when asked
        vtt = convert_file(srt, force=force)
        written.append(vtt)
    return written


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="SRT files or directories (default: FanMixes/*/subs + KidFriendly/*/subs)",
    )
    ap.add_argument("--force", action="store_true", help="Overwrite existing VTT even if newer")
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[1]
    targets = args.paths
    if not targets:
        targets = []
        for cat in ("FanMixes", "KidFriendly"):
            base = root / cat
            if not base.is_dir():
                continue
            for proj in base.iterdir():
                subs = proj / "subs"
                if subs.is_dir():
                    targets.append(subs)
    wrote = 0
    for t in targets:
        t = t if t.is_absolute() else root / t
        if t.is_dir():
            for p in convert_tree(t, force=args.force):
                print(p.relative_to(root) if p.is_relative_to(root) else p)
                wrote += 1
        elif t.is_file() and t.suffix.lower() == ".srt":
            p = convert_file(t, force=args.force)
            print(p.relative_to(root) if p.is_relative_to(root) else p)
            wrote += 1
        else:
            print(f"skip: {t}", file=sys.stderr)
    print(f"wrote/kept {wrote} vtt file(s)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
