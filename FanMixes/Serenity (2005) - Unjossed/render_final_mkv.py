#!/usr/bin/env python3
"""Render Serenity Unjossed from playlist2 — 4K HEVC 10-bit two-pass."""
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


def coalesce_for_render(
    segments: list[tuple[float, float]], gap: float = 0.05
) -> list[tuple[float, float]]:
    """Merge adjacent playlist clips so ffmpeg is not asked to concat thousands of trims."""
    if not segments:
        return segments
    merged: list[tuple[float, float]] = [segments[0]]
    for start, end in segments[1:]:
        ps, pe = merged[-1]
        if start <= pe + gap:
            merged[-1] = (ps, max(pe, end))
        else:
            merged.append((start, end))
    return merged


def probe_fps(video: Path) -> tuple[int, int]:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=r_frame_rate",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    num, den = proc.stdout.strip().split("/")
    return int(num), int(den)


def build_filter_complex(
    segments: list[tuple[float, float]], fps_num: int, fps_den: int
) -> str:
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
    ap.add_argument("--audio-kbps", type=int, default=384)
    ap.add_argument("--audio-channels", type=int, default=6)
    args = ap.parse_args()

    here = Path(__file__).resolve().parent
    kden = args.kdenlive or (here / "Serenity (2005) - Unjossed.kdenlive")
    root = ET.parse(kden).getroot()
    res = root.find(".//chain[@id='chain0']/property[@name='resource']")
    video = Path(args.video or res.text).resolve()
    subs = args.subs or kden.with_suffix(kden.suffix + ".shifted.srt")
    out = args.out or (here / "Serenity (2005) - Unjossed Edition.mkv")

    raw = parse_playlist2_segments(kden)
    segs = coalesce_for_render(raw)
    print(f"playlist clips={len(raw)} render trims={len(segs)}", file=sys.stderr)

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-of", "json", str(video)],
        check=True,
        capture_output=True,
        text=True,
    )
    fmt_br = float(json.loads(probe.stdout)["format"].get("bit_rate") or 7_000_000)
    v_kbps = args.video_kbps or max(2000, int(fmt_br / 1000 - args.audio_kbps - 100))
    fps_num, fps_den = probe_fps(video)

    tmp_root = Path(tempfile.gettempdir()) / "serenity_unjossed_render"
    tmp_root.mkdir(parents=True, exist_ok=True)
    fc_path = tmp_root / "filter.txt"
    fc_path.write_text(build_filter_complex(segs, fps_num, fps_den), encoding="utf-8")
    stats = "x265_serenity_pass"
    tmp_out = tmp_root / "nosubs.mkv"

    base = [
        "ffmpeg",
        "-hide_banner",
        "-y",
        "-analyzeduration",
        "100M",
        "-probesize",
        "100M",
        "-i",
        str(video),
        "-filter_complex_script",
        fc_path.name,
        "-map",
        "[outv]",
        "-map",
        "[outa]",
        "-pix_fmt",
        "yuv420p10le",
        "-c:v",
        "libx265",
        "-b:v",
        f"{v_kbps}k",
        "-maxrate",
        f"{int(v_kbps * 1.12)}k",
        "-bufsize",
        f"{int(v_kbps * 2)}k",
    ]
    run(
        base
        + [
            "-x265-params",
            f"pass=1:stats={stats}:log-level=info",
            "-an",
            "-f",
            "null",
            os.devnull,
        ],
        cwd=tmp_root,
    )
    run(
        base
        + [
            "-x265-params",
            f"pass=2:stats={stats}:log-level=info",
            "-c:a",
            "aac",
            "-b:a",
            f"{args.audio_kbps}k",
            "-ac",
            str(args.audio_channels),
            tmp_out.name,
        ],
        cwd=tmp_root,
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(tmp_out),
            "-i",
            str(subs),
            "-map",
            "0:v",
            "-map",
            "0:a",
            "-map",
            "1:0",
            "-c",
            "copy",
            "-c:s",
            "srt",
            "-disposition:s:0",
            "default",
            str(out),
        ]
    )
    print(f"Wrote {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
