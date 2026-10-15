#!/usr/bin/env python3
"""
Render Spirited Away Alena Edition: trim+concat from playlist2, two-pass libx264 (~source bitrate),
English dub AAC 5.1, mux shifted SRT as default subtitle track.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
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
            f"[0:a:0]atrim=start={start}:end={end_ex},asetpts=PTS-STARTPTS[a{i}]"
        )
    nv = len(segments)
    vcat = "".join(f"[v{i}]" for i in range(nv))
    acat = "".join(f"[a{i}]" for i in range(nv))
    concat = f"{vcat}concat=n={nv}:v=1:a=0[outv];{acat}concat=n={nv}:v=0:a=1[outa]"
    return ";".join(chunks) + ";" + concat


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd[:14]), ("..." if len(cmd) > 14 else ""), file=sys.stderr)
    subprocess.run(cmd, check=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kdenlive", type=Path, help="Path to .kdenlive (default: sibling in script dir)")
    ap.add_argument("--video", type=Path, help="Source rip (default: resource in kdenlive)")
    ap.add_argument("--subs", type=Path, help="Shifted SRT on output timeline (default: .kdenlive.shifted.srt)")
    ap.add_argument("--out", type=Path, help="Output .mkv")
    ap.add_argument("--passlog", type=Path, help="x264 multipass stats prefix")
    ap.add_argument("--video-kbps", type=int, default=0, help="Target video kbps (0 = derive from source)")
    ap.add_argument("--audio-kbps", type=int, default=224, help="AAC bitrate for 5.1 output")
    ap.add_argument("--threads", type=int, default=4, help="x264 -threads cap")
    args = ap.parse_args()

    here = Path(__file__).resolve().parent
    kden = args.kdenlive or (here / "Spirited Away (2001) - Alena Edition.kdenlive")
    if not kden.exists():
        raise SystemExit(f"missing kdenlive: {kden}")

    root = ET.parse(kden).getroot()
    chain = root.find(".//chain[@id='chain0']")
    res = chain.find("./property[@name='resource']")
    if res is None or not res.text:
        raise SystemExit("chain0 resource not found")
    video = Path(args.video or res.text).expanduser().resolve()
    if not video.exists():
        raise SystemExit(f"missing video: {video}")

    subs = args.subs or kden.with_suffix(kden.suffix + ".shifted.srt")
    if not subs.exists():
        raise SystemExit(f"missing shifted subs: {subs}")

    out = args.out or (here / "Spirited Away (2001) - Alena Edition.mkv")
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp_nosub = out.parent / ".tmp.spirited_alena_nosubs.mkv"
    passlog = args.passlog or Path("/tmp/x264_spirited_alena_pass")
    log_path = here / "render_final_mkv.log"

    segs = parse_playlist2_segments(kden)
    out_dur = sum(b - a for a, b in segs)
    print(f"segments={len(segs)} output_duration≈{out_dur:.1f}s", file=sys.stderr)

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-of", "json", str(video)],
        check=True,
        capture_output=True,
        text=True,
    )
    fmt = json.loads(probe.stdout).get("format", {})
    fmt_br = float(fmt.get("bit_rate") or 4_137_610)
    if args.video_kbps > 0:
        v_kbps = args.video_kbps
    else:
        v_kbps = max(1200, int((float(fmt_br) / 1000.0) - args.audio_kbps - 80))
    print(f"target video {v_kbps} kbps (format avg {int(fmt_br/1000)} kbps)", file=sys.stderr)

    fps_num, fps_den = 24000, 1001
    fc = build_filter_complex(segs, fps_num, fps_den)
    fc_path = Path("/tmp/spirited_alena_filter.txt")
    fc_path.write_text(fc, encoding="utf-8")

    stats = str(passlog)
    for p in (Path(stats + ".mbtree"), Path(stats)):
        if p.exists():
            p.unlink()

    thread_arg = ["-threads", str(args.threads)] if args.threads > 0 else []

    pass1 = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "info",
        "-y",
        "-i",
        str(video),
        "-filter_complex_script",
        str(fc_path),
        "-map",
        "[outv]",
        "-map",
        "[outa]",
        *thread_arg,
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        "-b:v",
        f"{v_kbps}k",
        "-maxrate",
        f"{int(v_kbps * 1.15)}k",
        "-bufsize",
        f"{int(v_kbps * 2)}k",
        "-pass",
        "1",
        "-passlogfile",
        stats,
        "-an",
        "-f",
        "null",
        "/dev/null",
    ]
    print("Pass 1…", file=sys.stderr)
    run(pass1)

    pass2 = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "info",
        "-y",
        "-i",
        str(video),
        "-filter_complex_script",
        str(fc_path),
        "-map",
        "[outv]",
        "-map",
        "[outa]",
        *thread_arg,
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        "-b:v",
        f"{v_kbps}k",
        "-maxrate",
        f"{int(v_kbps * 1.15)}k",
        "-bufsize",
        f"{int(v_kbps * 2)}k",
        "-pass",
        "2",
        "-passlogfile",
        stats,
        "-c:a",
        "aac",
        "-b:a",
        f"{args.audio_kbps}k",
        "-ac",
        "6",
        "-ar",
        "48000",
        str(tmp_nosub),
    ]
    print("Pass 2 (video+audio, no subs)…", file=sys.stderr)
    run(pass2)

    mux = [
        "ffmpeg",
        "-hide_banner",
        "-y",
        "-i",
        str(tmp_nosub),
        "-i",
        str(subs),
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
        "title=English (edit)",
        "-disposition:s:0",
        "default",
        str(out),
    ]
    print("Mux subtitles…", file=sys.stderr)
    run(mux)
    tmp_nosub.unlink(missing_ok=True)
    sz = out.stat().st_size
    msg = f"Wrote {out} ({sz / 1e9:.2f} GB)"
    print(msg, file=sys.stderr)
    log_path.write_text(msg + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
