#!/usr/bin/env python3
"""Render KidFriendly Pee-wee edit: trim+concat with seam transitions, two-pass libx265, AAC, mux shifted SRT."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Removal:
    start: float
    end: float
    join_fade: bool | None = None
    transition: str | None = None


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


def parse_remove_json(path: Path) -> list[Removal]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: list[Removal] = []
    for item in data.get("ranges", []):
        if isinstance(item, dict):
            out.append(
                Removal(
                    float(item["start"]),
                    float(item["end"]),
                    item.get("join_fade"),
                    item.get("transition"),
                )
            )
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            out.append(Removal(float(item[0]), float(item[1])))
    return sorted(out, key=lambda r: r.start)


def join_types_for_segments(
    segments: list[tuple[float, float]],
    removals: list[Removal],
    *,
    crossfade_min_gap: float = 72.0,
) -> list[str]:
    """Return join type between segment i and i+1: concat | audio_crossfade | wipeleft | fade_black."""
    if len(segments) < 2:
        return []
    types: list[str] = []
    for i in range(len(segments) - 1):
        prev_end = segments[i][1]
        next_start = segments[i + 1][0]
        gap = next_start - prev_end
        chosen = "concat"
        for rem in removals:
            if rem.end <= prev_end + 6.0 or rem.start >= next_start - 6.0:
                continue
            if rem.end <= next_start + 1.0 and rem.start >= prev_end - 6.0:
                if rem.transition == "wipeleft":
                    chosen = "wipeleft"
                elif rem.transition == "fade_black":
                    chosen = "fade_black"
                elif rem.join_fade is not False and gap >= crossfade_min_gap:
                    chosen = "audio_crossfade"
                else:
                    chosen = "concat"
                break
        types.append(chosen)
    return types


def build_filter_complex(
    segments: list[tuple[float, float]],
    join_types: list[str],
    fps_num: int,
    fps_den: int,
    *,
    crossfade_sec: float = 0.35,
    wipe_sec: float = 0.5,
    fade_black_sec: float = 0.75,
) -> str:
    fd = fps_den / float(fps_num)
    fps = f"{fps_num}/{fps_den}"
    n = len(segments)
    parts: list[str] = []
    durs: list[float] = []

    for i, (start, end_inclusive) in enumerate(segments):
        end_ex = end_inclusive + fd
        parts.append(
            f"[0:v]trim=start={start}:end={end_ex},setpts=PTS-STARTPTS,fps={fps}[v{i}];"
            f"[0:a]atrim=start={start}:end={end_ex},asetpts=PTS-STARTPTS[a{i}]"
        )
        durs.append(end_ex - start)

    if n == 1:
        parts.append("[v0]null[outv];[a0]anull[outa]")
        return ";".join(parts)

    cur_v, cur_a = "v0", "a0"
    out_dur = durs[0]

    for i in range(1, n):
        jt = join_types[i - 1] if i - 1 < len(join_types) else "concat"
        tag = f"j{i}"
        if jt == "wipeleft":
            offset = max(0.0, out_dur - wipe_sec)
            parts.append(
                f"[{cur_v}]fps={fps}[wpcv{tag}];"
                f"[v{i}]fps={fps}[wpnv{tag}];"
                f"[wpcv{tag}][wpnv{tag}]xfade=transition=wipeleft:duration={wipe_sec}:offset={offset}[xv{tag}];"
                f"[{cur_a}][a{i}]acrossfade=d={wipe_sec}:c1=tri:c2=tri[xa{tag}]"
            )
            cur_v, cur_a = f"xv{tag}", f"xa{tag}"
            out_dur = out_dur + durs[i] - wipe_sec
        elif jt == "fade_black":
            st_out = max(0.0, out_dur - fade_black_sec)
            parts.append(
                f"[{cur_v}]fade=t=out:st={st_out}:d={fade_black_sec}:color=black[fvout{tag}];"
                f"[v{i}]fade=t=in:st=0:d={fade_black_sec}:color=black[fvin{tag}];"
                f"[fvout{tag}][fvin{tag}]concat=n=2:v=1:a=0[xv{tag}];"
                f"[{cur_a}][a{i}]concat=n=2:v=0:a=1[xa{tag}]"
            )
            cur_v, cur_a = f"xv{tag}", f"xa{tag}"
            out_dur = out_dur + durs[i]
        elif jt == "audio_crossfade":
            parts.append(
                f"[{cur_v}][v{i}]concat=n=2:v=1:a=0[xv{tag}];"
                f"[{cur_a}][a{i}]acrossfade=d={crossfade_sec}[xa{tag}]"
            )
            cur_v, cur_a = f"xv{tag}", f"xa{tag}"
            out_dur = out_dur + durs[i]
        else:
            parts.append(
                f"[{cur_v}][v{i}]concat=n=2:v=1:a=0[xv{tag}];"
                f"[{cur_a}][a{i}]concat=n=2:v=0:a=1[xa{tag}]"
            )
            cur_v, cur_a = f"xv{tag}", f"xa{tag}"
            out_dur = out_dur + durs[i]

    parts.append(f"[{cur_v}]null[outv];[{cur_a}]anull[outa]")
    return ";".join(parts)


def run(cmd: list[str], *, cwd: Path | None = None) -> None:
    print("+", " ".join(cmd[:14]), ("..." if len(cmd) > 14 else ""), file=sys.stderr)
    subprocess.run(cmd, check=True, cwd=str(cwd) if cwd else None)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kdenlive", type=Path)
    ap.add_argument("--video", type=Path)
    ap.add_argument("--subs", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--ranges-json", type=Path)
    ap.add_argument("--video-kbps", type=int, default=0)
    ap.add_argument("--audio-kbps", type=int, default=192)
    ap.add_argument("--pix-fmt", type=str, default="yuv420p")
    args = ap.parse_args()

    here = Path(__file__).resolve().parent
    kden = args.kdenlive or (here / "Pee-wee's Big Adventure (1985) - KidFriendly Edition.kdenlive")
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
    if not subs.exists():
        raise SystemExit(f"missing shifted subs: {subs}")

    ranges_json = args.ranges_json or (here / "remove-pee-wee-kidfriendly-ranges.json")
    removals = parse_remove_json(ranges_json) if ranges_json.exists() else []

    out = args.out or (here / "Pee-wee's Big Adventure (1985) - KidFriendly Edition.mkv")
    tmp_root = Path(tempfile.gettempdir()) / "pee_wee_kid_render"
    tmp_root.mkdir(parents=True, exist_ok=True)
    tmp_nosub = tmp_root / "pee_wee_kid_nosubs.mkv"
    stats_file = tmp_root / "x265_pee_wee_pass.log"

    segs = parse_playlist2_segments(kden)
    joins = join_types_for_segments(segs, removals)
    if joins:
        print(f"join types: {joins}", file=sys.stderr)
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
    fc_path = tmp_root / "pee_wee_filter.txt"
    fc_path.write_text(
        build_filter_complex(segs, joins, fps_num, fps_den),
        encoding="utf-8",
    )
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
