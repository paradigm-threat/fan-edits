#!/usr/bin/env python3
"""Replace subtitle track in MKV (copy video/audio)."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", type=Path, required=True, help="MKV with video/audio")
    ap.add_argument("--subs", type=Path, required=True, help="SRT on output timeline")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    if not args.video.exists():
        raise SystemExit(f"missing: {args.video}")
    if not args.subs.exists():
        raise SystemExit(f"missing: {args.subs}")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.out.with_suffix(".remux.tmp.mkv")
    if tmp.exists():
        tmp.unlink()
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-y",
        "-i",
        str(args.video),
        "-i",
        str(args.subs),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-map",
        "1:0",
        "-c",
        "copy",
        "-c:s",
        "srt",
        "-metadata:s:s:0",
        "language=eng",
        "-metadata:s:s:0",
        "title=English (KidFriendly edit)",
        "-disposition:s:0",
        "default",
        str(tmp),
    ]
    print("+", " ".join(cmd), file=sys.stderr)
    subprocess.run(cmd, check=True)
    if args.out.exists():
        args.out.unlink()
    tmp.rename(args.out)
    print(f"Wrote {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
