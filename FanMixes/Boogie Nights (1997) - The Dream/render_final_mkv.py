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
        producer = ent.get("producer") or ""
        if not producer.startswith("chain"):
            continue
        a = timecode_to_seconds(ent.get("in", "0"))
        b = timecode_to_seconds(ent.get("out", "0"))
        if b > a:
            segs.append((a, b))
    if not segs:
        raise SystemExit("no chain entries in playlist2")
    return segs


def load_xfade(ranges_json: Path | None) -> tuple[str, float]:
    if ranges_json is None or not ranges_json.exists():
        return "fade", 0.4
    data = json.loads(ranges_json.read_text(encoding="utf-8"))
    xf = data.get("xfade") or {}
    transition = str(xf.get("transition") or "fade")
    duration = float(xf.get("duration") or 0.4)
    if not data.get("xfade"):
        for item in data.get("ranges", []):
            if isinstance(item, dict) and item.get("transition"):
                transition = str(item["transition"])
                break
    return transition, duration


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


def join_fades(
    segments: list[tuple[float, float]], fade_dur: float, min_gap: float
) -> list[float]:
    """Fade seconds pulled back at the start of each kept run. Index 0 is always 0.

    A long source hole uses the office fadeblack. A short hole (the Colonel
    beating) stays a hard cut.
    """
    fades = [0.0]
    for i in range(1, len(segments)):
        gap = segments[i][0] - segments[i - 1][1]
        fades.append(fade_dur if fade_dur > 0 and gap >= min_gap else 0.0)
    return fades


def last_audio_in(kdenlive: Path) -> float | None:
    """Source in-point of the audio entry that carries the end of the timeline.

    Playlist1 is the second audio track. On this cut it holds the scene after
    the Colonel, and its in-point is earlier than the picture in-point.
    """
    root = ET.parse(kdenlive).getroot()
    pl = root.find(".//playlist[@id='playlist1']")
    if pl is None:
        return None
    entries = [
        e
        for e in pl.findall("entry")
        if (e.get("producer") or "").startswith("chain")
    ]
    if not entries:
        return None
    return timecode_to_seconds(entries[-1].get("in", "0"))


def build_filter_complex(
    segments: list[tuple[float, float]],
    fps_num: int,
    fps_den: int,
    *,
    xfade: str,
    fade_dur: float,
    min_gap: float = 60.0,
    last_audio_start: float | None = None,
) -> str:
    fd = fps_den / float(fps_num)
    n = len(segments)
    if n < 1:
        raise SystemExit("no kept runs on playlist2")
    lead = 0.0
    if last_audio_start is not None and n >= 2:
        gap = segments[-1][0] - last_audio_start
        if 0.05 < gap < 30:
            lead = gap
    parts: list[str] = []
    for i, (start, end_inclusive) in enumerate(segments):
        end_ex = end_inclusive + fd
        a_start = start - lead if i == n - 1 and lead else start
        vpad = "outv" if n == 1 else f"v{i}"
        apad = "outa" if n == 1 else f"a{i}"
        parts.append(
            f"[0:v]trim=start={start:.3f}:end={end_ex:.3f},setpts=PTS-STARTPTS[{vpad}]"
        )
        parts.append(
            f"[0:a:0]atrim=start={a_start:.3f}:end={end_ex:.3f},asetpts=PTS-STARTPTS[{apad}]"
        )
    if n == 1:
        return ";".join(parts)

    fades = join_fades(segments, fade_dur, min_gap)
    vlabel, alabel = "v0", "a0"
    vlen = (segments[0][1] + fd) - segments[0][0]
    for i in range(1, n):
        seglen = (segments[i][1] + fd) - segments[i][0]
        vout = "outv" if i == n - 1 else f"vx{i}"
        aout = "outa" if i == n - 1 else f"ax{i}"
        jcut = i == n - 1 and lead > 0 and fades[i] == 0
        if fades[i] > 0:
            if vlen <= fades[i] + 0.05:
                raise SystemExit("kept run is shorter than the xfade")
            offset = round(vlen - fades[i], 3)
            parts.append(
                f"[{vlabel}][v{i}]xfade=transition={xfade}:duration={fades[i]}:offset={offset}[{vout}]"
            )
            parts.append(
                f"[{alabel}][a{i}]acrossfade=d={fades[i]}:c1=tri:c2=tri[{aout}]"
            )
            vlen = vlen + seglen - fades[i]
        elif jcut:
            if vlen <= lead + 0.05:
                raise SystemExit("kept run is shorter than the audio lead")
            head_end = round(vlen - lead, 3)
            parts.append(f"[{vlabel}][v{i}]concat=n=2:v=1:a=0[{vout}]")
            parts.append(f"[{alabel}]asplit=2[ah{i}][at{i}]")
            parts.append(
                f"[ah{i}]atrim=end={head_end:.3f},asetpts=PTS-STARTPTS[head{i}]"
            )
            parts.append(
                f"[at{i}]atrim=start={head_end:.3f},asetpts=PTS-STARTPTS[tail{i}]"
            )
            parts.append(f"[a{i}]asplit=2[ap{i}][ar{i}]")
            parts.append(
                f"[ap{i}]atrim=end={lead:.3f},asetpts=PTS-STARTPTS[pre{i}]"
            )
            parts.append(
                f"[ar{i}]atrim=start={lead:.3f},asetpts=PTS-STARTPTS[rest{i}]"
            )
            parts.append(
                f"[tail{i}][pre{i}]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix{i}]"
            )
            parts.append(
                f"[head{i}][mix{i}][rest{i}]concat=n=3:v=0:a=1[{aout}]"
            )
            vlen = vlen + seglen
        else:
            parts.append(f"[{vlabel}][v{i}]concat=n=2:v=1:a=0[{vout}]")
            parts.append(f"[{alabel}][a{i}]concat=n=2:v=0:a=1[{aout}]")
            vlen = vlen + seglen
        vlabel, alabel = vout, aout
    return ";".join(parts)


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


def remap_srt(
    src: Path,
    dst: Path,
    segments: list[tuple[float, float]],
    fades: list[float],
) -> int:
    """Map original-timeline cues onto the kept runs. Cues inside a hole are dropped.

    fades[i] is the overlap pulled back at the start of kept run i.
    """
    import re

    text = src.read_text(encoding="utf-8", errors="replace")
    tc = re.compile(
        r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*"
        r"(\d{2}):(\d{2}):(\d{2}),(\d{3})"
    )

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

    def locate(t: float) -> tuple[int, float] | None:
        cursor = 0.0
        for i, (a, b) in enumerate(segments):
            start_out = cursor - fades[i]
            if a - 0.04 <= t <= b + 0.04:
                return i, start_out + (t - a)
            cursor = start_out + (b - a)
        return None

    blocks = re.split(r"\n\s*\n", text.strip())
    kept: list[str] = []
    for block in blocks:
        m = tc.search(block)
        if not m:
            continue
        a = to_sec(*m.group(1, 2, 3, 4))
        b = to_sec(*m.group(5, 6, 7, 8))
        la = locate(a)
        lb = locate(b)
        if la is None and lb is None:
            continue
        if la is not None and lb is not None and la[0] != lb[0]:
            continue
        if la is None and lb is not None:
            # Starts in a hole and ends in a kept run: show the remainder.
            cursor = 0.0
            start_out = 0.0
            for i, (sa, sb) in enumerate(segments):
                start_out = cursor - fades[i]
                if i == lb[0]:
                    break
                cursor = start_out + (sb - sa)
            a_out, b_out = start_out, lb[1]
        elif la is not None and lb is None:
            a_out = la[1]
            b_out = a_out + max(0.04, segments[la[0]][1] - a)
        else:
            assert la is not None and lb is not None
            a_out, b_out = la[1], lb[1]
        if b_out <= a_out:
            b_out = a_out + 0.04
        new_line = f"{fmt(a_out)} --> {fmt(b_out)}"
        kept.append(tc.sub(new_line, block, count=1))
    renumbered: list[str] = []
    for i, block in enumerate(kept, 1):
        lines = block.splitlines()
        if lines and lines[0].strip().isdigit():
            lines[0] = str(i)
        else:
            lines.insert(0, str(i))
        renumbered.append("\n".join(lines))
    dst.write_text("\n\n".join(renumbered) + "\n", encoding="utf-8")
    return len(renumbered)


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
) -> None:
    if len(segments) != 2:
        raise SystemExit("seam preview needs exactly two kept runs")
    (_a0, b0), (a1, _b1) = segments
    pre = max(fade_dur + 0.5, lead)
    post = max(0.5, lead)
    t0 = max(0.0, b0 - pre)
    # Clip A ends on the outgoing shot; xfade consumes the last fade_dur of A
    # and the first fade_dur of B. Do not extend A past the cut or the diner
    # (or whatever was removed) leaks into the dissolve.
    len_a = pre
    len_b = post + fade_dur
    offset = round(pre - fade_dur, 3)
    pad = 3.0
    in0 = max(0.0, t0 - pad)
    in1 = max(0.0, a1 - pad)
    off0 = t0 - in0
    off1 = a1 - in1
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
            f"[v0][v1]xfade=transition={xfade}:duration={fade_dur}:offset={offset}[v];"
            f"[a0][a1]acrossfade=d={fade_dur}:c1=tri:c2=tri[a]"
        ),
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v",
        "libx265",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-tag:v",
        "hvc1",
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
    xfade, fade_dur = load_xfade(ranges_json)

    segs = parse_playlist2_segments(kden)
    print(f"segments={len(segs)} xfade={xfade} d={fade_dur}", file=sys.stderr)

    preview = args.preview_out or (here / "seam-01-preview.mp4")
    if args.preview_only or args.preview_out:
        write_seam_preview(
            video, segs, preview, xfade=xfade, fade_dur=fade_dur, lead=args.lead
        )
        print(f"Wrote seam preview {preview}", file=sys.stderr)
        if args.preview_only:
            return 0

    feature_srt = kden.with_suffix(".srt")
    subs_in = args.subs or (feature_srt if feature_srt.exists() else kden.with_suffix(kden.suffix + ".shifted.srt"))
    if not subs_in.exists():
        raise SystemExit(f"missing subs: {subs_in}")

    out = args.out or (here / f"{here.name} - final.mkv")
    out.parent.mkdir(parents=True, exist_ok=True)

    vmeta = probe_video_meta(video)
    ameta = probe_audio_meta(video)
    min_gap = 60.0
    fades = join_fades(segs, fade_dur, min_gap)
    audio_in = last_audio_in(kden)
    fc = build_filter_complex(
        segs,
        vmeta["fps_num"],
        vmeta["fps_den"],
        xfade=xfade,
        fade_dur=fade_dur,
        min_gap=min_gap,
        last_audio_start=audio_in,
    )
    scratch = Path(os.environ.get("FANEDIT_SCRATCH", "/media/ari/HD/FanEditRender"))
    tmp_root = scratch / "tmp" / "fanmix_encode"
    tmp_root.mkdir(parents=True, exist_ok=True)
    fc_path = tmp_root / "filter.txt"
    fc_path.write_text(fc, encoding="utf-8")
    tmp_nosub = tmp_root / "nosubs.mkv"
    subs_adj = tmp_root / "shifted-xfade.srt"
    n_cues = remap_srt(subs_in, subs_adj, segs, fades)
    lead = (segs[-1][0] - audio_in) if audio_in is not None else 0.0
    print(
        f"subs={subs_in.name} cues={n_cues} fades={fades} audio_lead={lead:.3f}",
        file=sys.stderr,
    )

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
