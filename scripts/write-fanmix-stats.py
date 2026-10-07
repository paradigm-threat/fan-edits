#!/usr/bin/env python3
"""Write FanMixes/<title>/stats.json from ffprobe of source + edit MKVs.

Example:
  python3 scripts/write-fanmix-stats.py \\
    --folder "FanMixes/The Mummy (1999) - Debugged" \\
    --original "The Mummy (1999)" \\
    --type FanFix \\
    --edition Debugged \\
    --source "/path/to/source.mkv" \\
    --edit "/path/to/The Mummy Debugged.mkv"
"""
from __future__ import annotations

import argparse
import json
import subprocess
from datetime import date
from pathlib import Path


def ffprobe_json(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size:stream=codec_name,width,height,codec_type",
            "-of",
            "json",
            str(path),
        ],
        text=True,
    )
    return json.loads(raw)


def fmt_hms(seconds: float) -> str:
    s = float(seconds)
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(round(s % 60))
    if sec == 60:
        m += 1
        sec = 0
    if m == 60:
        h += 1
        m = 0
    return f"{h}:{m:02d}:{sec:02d}"


def video_stream(doc: dict) -> dict:
    for st in doc.get("streams") or []:
        if st.get("codec_type") == "video":
            return st
    return {}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--folder", required=True, type=Path, help="FanMixes/... project folder")
    ap.add_argument("--original", required=True, help="Source film title")
    ap.add_argument("--type", default="FanFix", help="FanFix / FanMix / …")
    ap.add_argument("--edition", default="", help="Edition name")
    ap.add_argument("--source", required=True, type=Path, help="Theatrical source MKV")
    ap.add_argument("--edit", required=True, type=Path, help="Fanedit MKV")
    ap.add_argument("--notes", default="ffprobe source vs edit")
    args = ap.parse_args()

    folder = args.folder if args.folder.is_absolute() else Path.cwd() / args.folder
    source = args.source.resolve()
    edit = args.edit.resolve()
    if not source.is_file():
        raise SystemExit(f"missing source: {source}")
    if not edit.is_file():
        raise SystemExit(f"missing edit: {edit}")

    src = ffprobe_json(source)
    ed = ffprobe_json(edit)
    film_s = float(src["format"]["duration"])
    edit_s = float(ed["format"]["duration"])
    cut_s = film_s - edit_s
    size = int(ed["format"].get("size") or edit.stat().st_size)
    v = video_stream(ed)
    w = int(v.get("width") or 0)
    h = int(v.get("height") or 0)
    codec = v.get("codec_name") or ""
    avail = f"{h}p {codec.upper()} MKV" if h else f"{codec.upper()} MKV"

    doc = {
        "original": args.original,
        "type": args.type,
        "edition": args.edition,
        "filmRuntime": fmt_hms(film_s),
        "filmRuntimeSeconds": round(film_s, 3),
        "faneditRuntime": fmt_hms(edit_s),
        "faneditRuntimeSeconds": round(edit_s, 3),
        "timeCut": fmt_hms(cut_s),
        "timeCutSeconds": round(cut_s, 3),
        "availableIn": avail,
        "videoCodec": codec,
        "width": w,
        "height": h,
        "sizeBytes": size,
        "sizeGB": round(size / 1e9, 2),
        "measuredAt": date.today().isoformat(),
        "notes": args.notes,
    }
    out = folder / "stats.json"
    folder.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}")
    print(
        f"  film {doc['filmRuntime']}  edit {doc['faneditRuntime']}  "
        f"cut {doc['timeCut']}  {doc['sizeGB']} GB"
    )


if __name__ == "__main__":
    main()
