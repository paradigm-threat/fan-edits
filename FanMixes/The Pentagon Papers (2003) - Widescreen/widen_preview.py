#!/usr/bin/env python3
"""16:9 center-crop preview (no AI). Same geometry as the Widescreen edit."""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRT = ROOT / "The Pentagon Papers (2003) - Widescreen.english.srt"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--video", required=True, help="Local 4:3 source MKV")
    p.add_argument("--out", required=True)
    p.add_argument("--seconds", type=float, default=0, help="If >0, only encode this many seconds")
    args = p.parse_args()
    video = Path(args.video)
    out = Path(args.out)
    if not video.is_file():
        raise SystemExit(f"missing video: {video}")
    out.parent.mkdir(parents=True, exist_ok=True)
    vf = (
        "scale=iw*sar:ih:flags=lanczos,"
        "crop=iw:iw*9/16,"
        "scale=1920:1080:flags=lanczos,"
        "format=yuv420p10le"
    )
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-y",
        "-i",
        str(video),
    ]
    if args.seconds > 0:
        cmd.extend(["-t", str(args.seconds)])
    cmd.extend(["-vf", vf])
    if SRT.is_file():
        cmd.extend(["-i", str(SRT)])
    cmd.extend(
        [
            "-map",
            "0:v:0",
            "-map",
            "0:a",
            "-c:v",
            "libx265",
            "-preset",
            "fast",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p10le",
            "-c:a",
            "copy",
        ]
    )
    if SRT.is_file():
        cmd.extend(
            [
                "-map",
                "1:0",
                "-c:s",
                "srt",
                "-metadata:s:s:0",
                "language=eng",
                "-disposition:s:0",
                "default",
            ]
        )
    cmd.append(str(out))
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)
    print(f"Wrote {out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
