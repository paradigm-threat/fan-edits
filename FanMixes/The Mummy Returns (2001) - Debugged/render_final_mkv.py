#!/usr/bin/env python3
"""Render The Mummy Returns (2001) Debugged: playlist2 trim+concat, two-pass libx265, AAC stereo, mux shifted SRT."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path


def timecode_to_seconds(tc: str) -> float:
    tc = tc.strip().replace(",", ".")
    parts = tc.split(":")
    if len(parts) != 3:
        raise ValueError(f"bad timecode: {tc!r}")
    h, m = int(parts[0]), int(parts[1])
    s = float(parts[2])
    return h * 3600 + m * 60 + s


def parse_playlist2_segments(kdenlive: Path) -> list[tuple[float, float]]:
    root = ET.parse(kdenlive).getroot()
    pl = root.find(".//playlist[@id='playlist2']")
    if pl is None:
        raise SystemExit("playlist2 not found in kdenlive")
    segs: list[tuple[float, float]] = []
    for ent in pl.findall("entry"):
        if ent.get("producer") != "chain0":
            continue
        a = timecode_to_seconds(ent.get("in", "0"))
        b = timecode_to_seconds(ent.get("out", "0"))
        if b > a:
            segs.append((a, b))
    if not segs:
        raise SystemExit("no chain0 entries in playlist2")
    return segs


def build_filter_complex(segments: list[tuple[float, float]], fps_num: int, fps_den: int) -> str:
    fd = fps_den / float(fps_num)
    chunks: list[str] = []
    for i, (start, end_inclusive) in enumerate(segments):
        end_ex = end_inclusive + fd
        chunks.append(
            f"[0:v]trim=start={start}:end={end_ex},setpts=PTS-STARTPTS[v{i}];"
            f"[0:a]atrim=start={start}:end={end_ex},asetpts=PTS-STARTPTS[a{i}]"
        )
    nv = len(segments)
    vcat = "".join(f"[v{i}]" for i in range(nv))
    acat = "".join(f"[a{i}]" for i in range(nv))
    concat = f"{vcat}concat=n={nv}:v=1:a=0[outv];{acat}concat=n={nv}:v=0:a=1[outa]"
    return ";".join(chunks) + ";" + concat


def run(cmd: list[str], *, cwd: Path | None = None) -> None:
    print("+", " ".join(cmd[:14]), ("..." if len(cmd) > 14 else ""), file=sys.stderr)
    subprocess.run(cmd, check=True, cwd=str(cwd) if cwd else None)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kdenlive", type=Path)
    ap.add_argument("--video", type=Path)
    ap.add_argument("--subs", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--video-kbps", type=int, default=0)
    ap.add_argument("--audio-kbps", type=int, default=192)
    ap.add_argument("--pix-fmt", type=str, default="yuv420p")
    args = ap.parse_args()

    here = Path(__file__).resolve().parent
    kden = args.kdenlive or (here / "Bambi (1942) - KidFriendly Edition.kdenlive")
    if not kden.exists():
        raise SystemExit(f"missing kdenlive: {kden}")

    root = ET.parse(kden).getroot()
    chain = root.find(".//chain[@id='chain0']")
    res = chain.find("./property[@name='resource']")
    if res is None or not res.text:
        raise SystemExit("chain0 resource not found")
    video_path = res.text.lstrip("/")
    video = Path(args.video or (Path("N:/Videos") / video_path.replace("/", "\\")))
    if not video.exists():
        video = Path("N:/Videos") / Path(*video_path.split("/"))
    if not video.exists():
        raise SystemExit(f"missing video: {video}")

    subs = args.subs or kden.with_suffix(kden.suffix + ".shifted.srt")
    if subs.exists() and subs.stat().st_size < 128:
        raise SystemExit(
            f"shifted subs empty or corrupt ({subs}); regenerate with kdenlive_from_subs.py "
            "(ensure project .srt is UTF-8, not UTF-16)"
        )
    if not subs.exists():
        raise SystemExit(f"missing shifted subs: {subs}")

    out = args.out or (here / "Bambi (1942) - KidFriendly Edition.mkv")
    tmp_root = Path(tempfile.gettempdir()) / "bambi_kid_render"
    tmp_root.mkdir(parents=True, exist_ok=True)
    tmp_nosub = tmp_root / "bambi_kid_nosubs.mkv"
    stats_file = tmp_root / "x265_bambi_pass.log"

    segs = parse_playlist2_segments(kden)
    out_dur = sum(b - a for a, b in segs)
    print(f"segments={len(segs)} output_duration~{out_dur:.1f}s", file=sys.stderr)

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-of", "json", str(video)],
        check=True,
        capture_output=True,
        text=True,
    )
    fmt_br = float(json.loads(probe.stdout).get("format", {}).get("bit_rate") or 2_500_000)
    v_kbps = args.video_kbps or max(600, int(fmt_br / 1000 - args.audio_kbps - 80))
    print(f"target video {v_kbps} kbps pix_fmt={args.pix_fmt}", file=sys.stderr)

    fps_num, fps_den = 24000, 1001
    fc_path = tmp_root / "bambi_filter.txt"
    fc_path.write_text(build_filter_complex(segs, fps_num, fps_den), encoding="utf-8")
    stats_name = stats_file.name
    for p in (stats_file, Path(str(stats_file) + ".mbtree")):
        p.unlink(missing_ok=True)

    pass1 = [
        "ffmpeg", "-hide_banner", "-y", "-i", str(video),
        "-filter_complex_script", fc_path.name,
        "-map", "[outv]", "-map", "[outa]",
        "-pix_fmt", args.pix_fmt, "-c:v", "libx265",
        "-b:v", f"{v_kbps}k", "-maxrate", f"{int(v_kbps * 1.15)}k",
        "-bufsize", f"{int(v_kbps * 2)}k",
        "-x265-params", f"pass=1:stats={stats_name}:log-level=info",
        "-an", "-f", "null", os.devnull,
    ]
    print("Pass 1…", file=sys.stderr)
    run(pass1, cwd=tmp_root)

    pass2 = [
        "ffmpeg", "-hide_banner", "-y", "-i", str(video),
        "-filter_complex_script", fc_path.name,
        "-map", "[outv]", "-map", "[outa]",
        "-pix_fmt", args.pix_fmt, "-c:v", "libx265",
        "-b:v", f"{v_kbps}k", "-maxrate", f"{int(v_kbps * 1.15)}k",
        "-bufsize", f"{int(v_kbps * 2)}k",
        "-x265-params", f"pass=2:stats={stats_name}:log-level=info",
        "-c:a", "aac", "-b:a", f"{args.audio_kbps}k", "-ac", "2", "-ar", "48000",
        str(tmp_nosub),
    ]
    print("Pass 2…", file=sys.stderr)
    run(pass2, cwd=tmp_root)

    mux = [
        "ffmpeg", "-hide_banner", "-y", "-i", str(tmp_nosub), "-i", str(subs),
        "-map", "0:v:0", "-map", "0:a:0", "-map", "1:0",
        "-c", "copy", "-c:s", "srt",
        "-metadata:s:s:0", "language=eng",
        "-metadata:s:s:0", "title=English (KidFriendly edit)",
        "-disposition:s:0", "default",
        str(out),
    ]
    print("Mux subtitles…", file=sys.stderr)
    run(mux)
    tmp_nosub.unlink(missing_ok=True)
    print(f"Wrote {out} ({out.stat().st_size / 1e9:.2f} GB)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
