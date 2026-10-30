#!/usr/bin/env python3
"""
Render a one-removal FanMix with xfade + acrossfade at the join.

Reads playlist2 from the .kdenlive (sparse kept-runs) and optional xfade
settings from remove-*-ranges.json. Encodes libx265 CRF for smaller
MKVs (8-bit stereo Blu-ray rips). Adjusts shifted SRT by the xfade overlap.
"""
from __future__ import annotations

import argparse
import json
import os
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


def load_join(ranges_json: Path | None) -> tuple[str, float, float]:
    """Return (video_transition, video_fade_dur, audio_fade_dur).

    Video duration 0 is a hard cut. audio_fade is a duration-preserving
    fade-out/fade-in (not an overlapping acrossfade, so picture in/out
    points and A/V sync stay put).
    """
    if ranges_json is None or not ranges_json.exists():
        return "fade", 0.4, 0.4
    data = json.loads(ranges_json.read_text(encoding="utf-8"))
    xf = data.get("xfade") or {}
    transition = str(xf.get("transition") or "fade")
    if "duration" in xf and xf["duration"] is not None:
        duration = float(xf["duration"])
    else:
        duration = 0.4
    if not data.get("xfade"):
        for item in data.get("ranges", []):
            if isinstance(item, dict) and item.get("transition"):
                transition = str(item["transition"])
                break
    hard_video = transition in {"cut", "none", "concat"} or any(
        isinstance(item, dict) and item.get("join_fade") is False
        for item in data.get("ranges", [])
    )
    video_dur = 0.0 if hard_video else duration
    if "audio_fade" in xf and xf["audio_fade"] is not None:
        audio_dur = float(xf["audio_fade"])
    elif video_dur > 0:
        audio_dur = video_dur
    else:
        audio_dur = 0.0
    return transition, video_dur, audio_dur


def probe_video_meta(video: Path) -> dict:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,pix_fmt,codec_name",
            "-of",
            "json",
            str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    streams = json.loads(proc.stdout).get("streams", [])
    if not streams:
        raise SystemExit(f"no video stream in {video}")
    s = streams[0]
    num, den = (int(x) for x in s["r_frame_rate"].split("/"))
    return {
        "width": int(s["width"]),
        "height": int(s["height"]),
        "fps_num": num,
        "fps_den": den,
        "pix_fmt": s.get("pix_fmt", "yuv420p"),
        "codec": s.get("codec_name", "h264"),
    }


def probe_audio_meta(video: Path) -> dict:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=sample_rate,channels",
            "-of",
            "json",
            str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    streams = json.loads(proc.stdout).get("streams", [])
    if not streams:
        return {"sample_rate": 48000, "channels": 2}
    s = streams[0]
    return {
        "sample_rate": int(s.get("sample_rate") or 48000),
        "channels": int(s.get("channels") or 2),
    }


def audio_fade_concat(audio_dur: float, len_a: float, out_label: str = "outa") -> str:
    """Fade out A and fade in B, then concat (same length as video concat)."""
    if audio_dur <= 0:
        return f"[a0][a1]concat=n=2:v=0:a=1[{out_label}]"
    st = max(0.0, len_a - audio_dur)
    return (
        f"[a0]afade=t=out:st={st:.3f}:d={audio_dur}:curve=tri[a0f];"
        f"[a1]afade=t=in:st=0:d={audio_dur}:curve=tri[a1f];"
        f"[a0f][a1f]concat=n=2:v=0:a=1[{out_label}]"
    )


def build_filter_complex(
    segments: list[tuple[float, float]],
    fps_num: int,
    fps_den: int,
    *,
    xfade: str,
    fade_dur: float,
    audio_dur: float = 0.0,
) -> str:
    fd = fps_den / float(fps_num)
    if len(segments) == 1:
        a, b = segments[0]
        end_ex = b + fd
        return (
            f"[0:v]trim=start={a}:end={end_ex},setpts=PTS-STARTPTS[outv];"
            f"[0:a:0]atrim=start={a}:end={end_ex},asetpts=PTS-STARTPTS[outa]"
        )
    if len(segments) != 2:
        raise SystemExit(f"this renderer expects 1–2 kept runs, got {len(segments)}")

    (a0, b0), (a1, b1) = segments
    end0 = b0 + fd
    end1 = b1 + fd
    len0 = end0 - a0

    if fade_dur <= 0:
        chunks: list[str] = []
        for i, (start, end_inclusive) in enumerate(segments):
            end_ex = end_inclusive + fd
            chunks.append(
                f"[0:v]trim=start={start}:end={end_ex},setpts=PTS-STARTPTS[v{i}];"
                f"[0:a:0]atrim=start={start}:end={end_ex},asetpts=PTS-STARTPTS[a{i}]"
            )
        return (
            ";".join(chunks)
            + ";[v0][v1]concat=n=2:v=1:a=0[outv];"
            + audio_fade_concat(audio_dur, len0, "outa")
        )

    if len0 <= fade_dur + 0.05:
        raise SystemExit("first kept run is shorter than the xfade")
    offset = round(len0 - fade_dur, 3)
    a_join = (
        f"[a0][a1]acrossfade=d={fade_dur}:c1=tri:c2=tri[outa]"
        if audio_dur <= 0 or abs(audio_dur - fade_dur) < 1e-6
        else audio_fade_concat(audio_dur, len0, "outa")
    )
    return (
        f"[0:v]trim=start={a0}:end={end0},setpts=PTS-STARTPTS[v0];"
        f"[0:v]trim=start={a1}:end={end1},setpts=PTS-STARTPTS[v1];"
        f"[v0][v1]xfade=transition={xfade}:duration={fade_dur}:offset={offset}[outv];"
        f"[0:a:0]atrim=start={a0}:end={end0},asetpts=PTS-STARTPTS[a0];"
        f"[0:a:0]atrim=start={a1}:end={end1},asetpts=PTS-STARTPTS[a1];"
        f"{a_join}"
    )


def shift_srt_for_xfade(src: Path, dst: Path, join_out: float, fade_dur: float) -> None:
    """Cues after the join move earlier by fade_dur (xfade overlap)."""
    if fade_dur <= 0:
        dst.write_bytes(src.read_bytes())
        return
    text = src.read_text(encoding="utf-8", errors="replace")

    def to_sec(h: str, m: str, s: str, ms: str) -> float:
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

    def fmt(t: float) -> str:
        if t < 0:
            t = 0.0
        h = int(t // 3600)
        t -= h * 3600
        m = int(t // 60)
        t -= m * 60
        s = int(t)
        ms = int(round((t - s) * 1000))
        if ms >= 1000:
            ms = 0
            s += 1
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    import re

    tc = re.compile(
        r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*"
        r"(\d{2}):(\d{2}):(\d{2}),(\d{3})"
    )

    def repl(m: re.Match[str]) -> str:
        a = to_sec(m.group(1), m.group(2), m.group(3), m.group(4))
        b = to_sec(m.group(5), m.group(6), m.group(7), m.group(8))
        if a >= join_out:
            a -= fade_dur
            b -= fade_dur
        elif b > join_out:
            b = max(a + 0.04, b - fade_dur)
        return f"{fmt(a)} --> {fmt(b)}"

    dst.write_text(tc.sub(repl, text), encoding="utf-8")


def run(cmd: list[str], *, cwd: Path | None = None) -> None:
    print("+", " ".join(str(x) for x in cmd[:16]), ("..." if len(cmd) > 16 else ""), file=sys.stderr)
    subprocess.run(cmd, check=True, cwd=str(cwd) if cwd else None)


def write_seam_preview(
    video: Path,
    segments: list[tuple[float, float]],
    out: Path,
    *,
    xfade: str,
    fade_dur: float,
    lead: float,
    audio_dur: float = 0.0,
) -> None:
    if len(segments) != 2:
        raise SystemExit("seam preview needs exactly two kept runs")
    (_a0, b0), (a1, _b1) = segments
    pre = max(max(fade_dur, audio_dur) + 0.5, lead)
    post = max(0.5, lead)
    t0 = max(0.0, b0 - pre)
    # Clip A ends on the outgoing shot. For xfade, the overlap is the last
    # fade_dur of A and the first fade_dur of B — never extend A past the cut.
    # fade_dur <= 0 is a hard picture cut (concat).
    len_a = pre
    len_b = post + max(fade_dur, 0.0)
    offset = round(pre - fade_dur, 3) if fade_dur > 0 else 0.0
    pad = 3.0
    in0 = max(0.0, t0 - pad)
    in1 = max(0.0, a1 - pad)
    off0 = t0 - in0
    off1 = a1 - in1
    if fade_dur <= 0:
        join = "[v0][v1]concat=n=2:v=1:a=0[v];" + audio_fade_concat(audio_dur, len_a, "a")
    else:
        join = (
            f"[v0][v1]xfade=transition={xfade}:duration={fade_dur}:offset={offset}[v];"
            f"[a0][a1]acrossfade=d={fade_dur}:c1=tri:c2=tri[a]"
        )
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-y",
        "-ss",
        f"{in0:.3f}",
        "-i",
        str(video),
        "-ss",
        f"{in1:.3f}",
        "-i",
        str(video),
        "-filter_complex",
        (
            f"[0:v]trim=start={off0:.3f}:end={off0+len_a:.3f},setpts=PTS-STARTPTS[v0];"
            f"[1:v]trim=start={off1:.3f}:end={off1+len_b:.3f},setpts=PTS-STARTPTS[v1];"
            f"[0:a:0]atrim=start={off0:.3f}:end={off0+len_a:.3f},asetpts=PTS-STARTPTS[a0];"
            f"[1:a:0]atrim=start={off1:.3f}:end={off1+len_b:.3f},asetpts=PTS-STARTPTS[a1];"
            f"{join}"
        ),
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        str(out),
    ]
    run(cmd)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kdenlive", type=Path)
    ap.add_argument("--video", type=Path)
    ap.add_argument("--subs", type=Path)
    ap.add_argument("--ranges-json", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--preview-only", action="store_true")
    ap.add_argument("--preview-out", type=Path)
    ap.add_argument("--lead", type=float, default=6.0)
    ap.add_argument("--crf", type=int, default=23)
    ap.add_argument("--preset", default="fast")
    ap.add_argument("--audio-kbps", type=int, default=192)
    args = ap.parse_args()

    here = Path(__file__).resolve().parent
    kden_candidates = list(here.glob("*.kdenlive"))
    kden = args.kdenlive or (kden_candidates[0] if kden_candidates else None)
    if kden is None or not kden.exists():
        raise SystemExit(f"missing kdenlive in {here}")

    root = ET.parse(kden).getroot()
    chain = root.find(".//chain[@id='chain0']")
    res = chain.find("./property[@name='resource']") if chain is not None else None
    video = Path(args.video or (res.text if res is not None else "")).expanduser()
    if not video.is_file():
        raise SystemExit(f"missing video: {video}")

    ranges_json = args.ranges_json
    if ranges_json is None:
        found = list(here.glob("remove-*-ranges.json"))
        ranges_json = found[0] if found else None
    xfade, fade_dur, audio_dur = load_join(ranges_json)

    segs = parse_playlist2_segments(kden)
    print(
        f"segments={len(segs)} xfade={xfade} video_d={fade_dur} audio_d={audio_dur}",
        file=sys.stderr,
    )

    preview = args.preview_out or (here / "seam-01-preview.mp4")
    if args.preview_only or args.preview_out:
        write_seam_preview(
            video,
            segs,
            preview,
            xfade=xfade,
            fade_dur=fade_dur,
            lead=args.lead,
            audio_dur=audio_dur,
        )
        print(f"Wrote seam preview {preview}", file=sys.stderr)
        if args.preview_only:
            return 0

    subs_in = args.subs or kden.with_suffix(kden.suffix + ".shifted.srt")
    if not subs_in.exists():
        raise SystemExit(f"missing shifted subs: {subs_in}")

    out = args.out or (here / f"{here.name} - final.mkv")
    out.parent.mkdir(parents=True, exist_ok=True)

    vmeta = probe_video_meta(video)
    ameta = probe_audio_meta(video)
    fc = build_filter_complex(
        segs,
        vmeta["fps_num"],
        vmeta["fps_den"],
        xfade=xfade,
        fade_dur=fade_dur,
        audio_dur=audio_dur,
    )
    scratch = Path(os.environ.get("FANEDIT_SCRATCH", "/media/ari/HD/FanEditRender"))
    tmp_root = scratch / "tmp" / "fanmix_encode"
    tmp_root.mkdir(parents=True, exist_ok=True)
    fc_path = tmp_root / "filter.txt"
    fc_path.write_text(fc, encoding="utf-8")
    tmp_nosub = tmp_root / "nosubs.mkv"
    subs_adj = tmp_root / "shifted-xfade.srt"
    join_out = segs[0][1] - segs[0][0] if segs else 0.0
    shift_srt_for_xfade(subs_in, subs_adj, join_out, fade_dur)

    pix = "yuv420p"
    encode = [
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
        "-c:v",
        "libx265",
        "-preset",
        args.preset,
        "-crf",
        str(args.crf),
        "-pix_fmt",
        pix,
        "-tag:v",
        "hvc1",
        "-c:a",
        "aac",
        "-b:a",
        f"{args.audio_kbps}k",
        "-ac",
        str(ameta["channels"]),
        "-ar",
        str(ameta["sample_rate"]),
        "-movflags",
        "+faststart",
        str(tmp_nosub),
    ]
    print("Encode (xfade join, no subs, libx265)…", file=sys.stderr)
    run(encode)

    mux = [
        "ffmpeg",
        "-hide_banner",
        "-y",
        "-i",
        str(tmp_nosub),
        "-i",
        str(subs_adj),
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
    print(f"Wrote {out} ({sz / 1e9:.2f} GB)", file=sys.stderr)
    (here / "render_final_mkv.log").write_text(f"Wrote {out} ({sz / 1e9:.2f} GB)\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
