#!/usr/bin/env python3
"""
Build a Kdenlive MLT project from an SRT and optional removal ranges.

Outputs:
  - .kdenlive (playlist2 = kept source segments on chain0)
  - .kdenlive.ass (preview subs on output timeline)
  - .kdenlive.shifted.srt (subs on output timeline)

Used by FanMix generate-*.sh scripts.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Cue:
    start: float
    end: float
    text: str


@dataclass
class Range:
    start: float
    end: float
    join_fade: bool | None = None
    transition: str | None = None


def parse_srt(path: Path) -> list[Cue]:
    raw = path.read_bytes()
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        text = raw.decode("utf-16")
    else:
        text = raw.decode("utf-8", errors="replace")
    blocks = re.split(r"\n\s*\n", text.strip())
    cues: list[Cue] = []
    tc = re.compile(
        r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*"
        r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})"
    )

    def to_sec(h: str, m: str, s: str, ms: str) -> float:
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

    for block in blocks:
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if len(lines) < 2:
            continue
        m = tc.search(block)
        if not m:
            continue
        start = to_sec(m.group(1), m.group(2), m.group(3), m.group(4))
        end = to_sec(m.group(5), m.group(6), m.group(7), m.group(8))
        body = tc.sub("", block, count=1).strip()
        body = re.sub(r"^\d+\s*\n", "", body, count=1).strip()
        cues.append(Cue(start, end, body))
    return cues


def parse_remove_json(path: Path) -> list[Range]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: list[Range] = []
    for item in data.get("ranges", []):
        if isinstance(item, dict):
            out.append(
                Range(
                    float(item["start"]),
                    float(item["end"]),
                    item.get("join_fade"),
                    item.get("transition"),
                )
            )
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            out.append(Range(float(item[0]), float(item[1])))
    return sorted(out, key=lambda r: r.start)


def probe_duration(video: Path) -> float:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(proc.stdout.strip())


def probe_video_meta(video: Path) -> dict:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,codec_name",
            "-of",
            "json",
            str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    import json as _json

    streams = _json.loads(proc.stdout).get("streams", [])
    if not streams:
        raise SystemExit(f"no video stream in {video}")
    s = streams[0]
    num, den = (int(x) for x in s["r_frame_rate"].split("/"))
    return {
        "width": int(s["width"]),
        "height": int(s["height"]),
        "fps_num": num,
        "fps_den": den,
        "codec": s.get("codec_name", "hevc"),
    }


def segments_from_subs(cues: list[Cue], duration: float) -> list[tuple[float, float]]:
    """Split full timeline at each subtitle start (scene-per-subtitle-block)."""
    if not cues:
        return [(0.0, duration)]
    splits = {0.0, duration}
    for c in cues:
        splits.add(max(0.0, min(duration, c.start)))
        splits.add(max(0.0, min(duration, c.end)))
    pts = sorted(splits)
    segs: list[tuple[float, float]] = []
    for a, b in zip(pts, pts[1:]):
        if b - a > 0.001:
            segs.append((a, b))
    return segs


def subtract_ranges(
    segments: list[tuple[float, float]], removals: list[Range]
) -> list[tuple[float, float]]:
    if not removals:
        return segments
    kept: list[tuple[float, float]] = []
    for start, end in segments:
        parts = [(start, end)]
        for rem in removals:
            nxt: list[tuple[float, float]] = []
            for a, b in parts:
                if rem.end <= a or rem.start >= b:
                    nxt.append((a, b))
                    continue
                if a < rem.start:
                    nxt.append((a, rem.start))
                if rem.end < b:
                    nxt.append((rem.end, b))
            parts = nxt
        kept.extend(parts)
    merged: list[tuple[float, float]] = []
    for seg in sorted(kept):
        if not merged:
            merged.append(seg)
            continue
        # Only merge overlapping intervals (not merely adjacent subtitle blocks).
        if seg[0] < merged[-1][1] - 0.001:
            merged[-1] = (merged[-1][0], max(merged[-1][1], seg[1]))
        else:
            merged.append(seg)
    return merged


def snap_removal_edges_to_keyframes_meta(
    removals: list[Range], video: Path
) -> list[Range]:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-skip_frame",
            "nokey",
            "-show_entries",
            "frame=best_effort_timestamp_time",
            "-of",
            "csv=p=0",
            str(video),
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print("warn: keyframe probe failed, skipping snap", file=sys.stderr)
        return removals
    keys = sorted(
        float(x.strip().rstrip(","))
        for x in proc.stdout.splitlines()
        if x.strip()
    )
    if not keys:
        return removals

    def snap_start(t: float) -> float:
        c = [k for k in keys if k <= t]
        return c[-1] if c else keys[0]

    def snap_end(t: float) -> float:
        c = [k for k in keys if k >= t]
        return c[0] if c else keys[-1]

    return [
        Range(snap_start(r.start), snap_end(r.end), r.join_fade) for r in removals
    ]


def sec_to_tc(sec: float, fps_num: int, fps_den: int) -> str:
    if sec < 0:
        sec = 0.0
    h = int(sec // 3600)
    sec -= h * 3600
    m = int(sec // 60)
    sec -= m * 60
    s = int(sec)
    ms = int(round((sec - s) * 1000))
    if ms >= 1000:
        ms = 0
        s += 1
        if s >= 60:
            s = 0
            m += 1
            if m >= 60:
                m = 0
                h += 1
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def parse_playlist2_segments(kdenlive: Path) -> list[tuple[float, float]]:
    """Read kept segments from written .kdenlive (matches render/export)."""
    pl = ET.parse(kdenlive).find(".//playlist[@id='playlist2']")
    if pl is None:
        raise SystemExit("playlist2 not found")
    segs: list[tuple[float, float]] = []

    def tc_to_sec(tc: str) -> float:
        tc = tc.strip().replace(",", ".")
        h, m, s = tc.split(":")
        return int(h) * 3600 + int(m) * 60 + float(s)

    for ent in pl.findall("entry"):
        if ent.get("producer") != "chain0":
            continue
        a = tc_to_sec(ent.get("in", "0"))
        b = tc_to_sec(ent.get("out", "0"))
        if b > a:
            segs.append((a, b))
    if not segs:
        raise SystemExit("no chain0 entries in playlist2")
    return segs


def build_shifted_srt(cues: list[Cue], kept: list[tuple[float, float]]) -> str:
    """Map source-time cues onto output timeline by kept segments."""
    out_lines: list[str] = []
    idx = 1
    out_t = 0.0

    def fmt(t: float) -> str:
        h = int(t // 3600)
        t -= h * 3600
        m = int(t // 60)
        t -= m * 60
        s = int(t)
        ms = int(round((t - s) * 1000))
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    for a, b in kept:
        seg_len = b - a
        for c in cues:
            if c.end <= a or c.start >= b:
                continue
            cs = max(c.start, a)
            ce = min(c.end, b)
            ns = out_t + (cs - a)
            ne = out_t + (ce - a)
            out_lines.append(str(idx))
            out_lines.append(f"{fmt(ns)} --> {fmt(ne)}")
            out_lines.append(c.text.replace("\n", "\n"))
            out_lines.append("")
            idx += 1
        out_t += seg_len
    return "\n".join(out_lines).strip() + "\n"


def build_ass(cues: list[Cue], kept: list[tuple[float, float]]) -> str:
    srt = build_shifted_srt(cues, kept)
    # Minimal ASS header; dialogue lines from shifted SRT
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 3840
PlayResY: 1632

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]
    tc_re = re.compile(
        r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})"
    )

    def to_ass(t: float) -> str:
        h = int(t // 3600)
        t -= h * 3600
        m = int(t // 60)
        t -= m * 60
        s = int(t)
        cs = int(round((t - s) * 100))
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    blocks = re.split(r"\n\s*\n", srt.strip())
    for block in blocks:
        m = tc_re.search(block)
        if not m:
            continue
        st = (
            int(m.group(1)) * 3600
            + int(m.group(2)) * 60
            + int(m.group(3))
            + int(m.group(4)) / 1000.0
        )
        en = (
            int(m.group(5)) * 3600
            + int(m.group(6)) * 60
            + int(m.group(7))
            + int(m.group(8)) / 1000.0
        )
        text = tc_re.sub("", block, count=1).strip()
        text = re.sub(r"^\d+\s*\n", "", text, count=1).strip()
        text = text.replace("\n", "\\N")
        lines.append(
            f"Dialogue: 0,{to_ass(st)},{to_ass(en)},Default,,0,0,0,,{text}"
        )
    return "\n".join(lines)


def write_kdenlive(
    out: Path,
    video: Path,
    kept: list[tuple[float, float]],
    meta: dict,
    root: Path,
    ass_name: str,
    join_fade_sec: float,
    join_fade_min_gap: float,
    removals: list[Range],
) -> None:
    fps_num, fps_den = meta["fps_num"], meta["fps_den"]
    duration = kept[-1][1] if kept else 0.0
    out_dur = sum(b - a for a, b in kept)
    out_tc = sec_to_tc(out_dur, fps_num, fps_den)
    chain_out = sec_to_tc(probe_duration(video), fps_num, fps_den)

    # Kdenlive resource: match repo style (/Horror and SciFi/... under N:\Videos)
    parts = list(video.parts)
    res = video.as_posix()
    if "Videos" in parts:
        i = parts.index("Videos")
        res = "/" + "/".join(parts[i + 1 :])

    uid = str(uuid.uuid4())
    seq_uid = "{" + str(uuid.uuid4()) + "}"

    def entry_xml(a: float, b: float, fade_in: bool, fade_out: bool) -> str:
        in_tc = sec_to_tc(a, fps_num, fps_den)
        out_tc = sec_to_tc(b, fps_num, fps_den)
        fid = uuid.uuid4().hex[:8]
        xml = [
            f'  <entry in="{in_tc}" out="{out_tc}" producer="chain0">',
            '   <property name="kdenlive:id">5</property>',
        ]
        fd = join_fade_sec
        if fade_out:
            fo_in = sec_to_tc(b - fd, fps_num, fps_den)
            xml.append(f'   <filter id="ajfadeout_{fid}" in="{fo_in}" out="{out_tc}">')
            xml.append('    <property name="window">75</property>')
            xml.append('    <property name="max_gain">20dB</property>')
            xml.append('    <property name="mlt_service">volume</property>')
            xml.append('    <property name="kdenlive_id">fadeout</property>')
            xml.append('    <property name="gain">1</property>')
            xml.append('    <property name="end">0</property>')
            xml.append("   </filter>")
        if fade_in:
            fi_out = sec_to_tc(a + fd, fps_num, fps_den)
            xml.append(f'   <filter id="ajfadein_{fid}" in="{in_tc}" out="{fi_out}">')
            xml.append('    <property name="window">75</property>')
            xml.append('    <property name="max_gain">20dB</property>')
            xml.append('    <property name="mlt_service">volume</property>')
            xml.append('    <property name="kdenlive_id">fadein</property>')
            xml.append('    <property name="gain">0</property>')
            xml.append('    <property name="end">1</property>')
            xml.append("   </filter>")
        xml.append("  </entry>")
        return "\n".join(xml)

    entries: list[str] = []
    prev_end: float | None = None
    for i, (a, b) in enumerate(kept):
        fade_in = fade_out = False
        if prev_end is not None:
            gap = a - prev_end
            if gap >= join_fade_min_gap:
                allow = True
                for rem in removals:
                    if rem.join_fade is False and rem.end <= a and rem.start >= prev_end:
                        allow = False
                if allow:
                    fade_in = fade_out = True
        entries.append(entry_xml(a, b, fade_in, fade_out))
        prev_end = b

    pl2 = "\n".join(entries)
    pl3 = pl2  # duplicate for video track playlist3 with brightness fades (optional minimal)

    w, h = meta["width"], meta["height"]
    profile = (
        f' <profile colorspace="709" description="{w}x{h} {fps_num}/{fps_den}fps" '
        f'frame_rate_num="{fps_num}" frame_rate_den="{fps_den}" height="{h}" '
        f'progressive="1" sample_aspect_num="1" sample_aspect_den="1" width="{w}" />'
    )

    xml = f"""<?xml version='1.0' encoding='utf-8'?>
<mlt LC_NUMERIC="en_US.UTF-8" producer="main_bin" root="{root.as_posix()}" version="7.33.0">
{profile}
 <producer id="producer0" in="00:00:00.000" out="{out_tc}">
  <property name="length">2147483647</property>
  <property name="eof">continue</property>
  <property name="resource">black</property>
  <property name="aspect_ratio">1</property>
  <property name="mlt_service">color</property>
  <property name="kdenlive:playlistid">black_track</property>
  <property name="mlt_image_format">rgba</property>
  <property name="set.test_audio">0</property>
 </producer>
 <playlist id="playlist0" />
 <playlist id="playlist1" />
 <tractor id="tractor0" in="00:00:00.000">
  <property name="kdenlive:audio_track">1</property>
  <property name="kdenlive:trackheight">84</property>
  <property name="kdenlive:timeline_active">1</property>
  <track hide="video" producer="playlist0" />
  <track hide="video" producer="playlist1" />
 </tractor>
 <chain id="chain0" out="{chain_out}">
  <property name="eof">pause</property>
  <property name="resource">{res}</property>
  <property name="mlt_service">avformat-novalidate</property>
  <property name="seekable">1</property>
  <property name="audio_index">0</property>
  <property name="video_index">0</property>
  <property name="vstream">0</property>
  <property name="astream">0</property>
  <property name="kdenlive:id">5</property>
  <property name="kdenlive:clip_type">0</property>
  <property name="kdenlive:folderid">-1</property>
 </chain>
 <playlist id="playlist2">
  <property name="kdenlive:audio_track">1</property>
{pl2}
 </playlist>
 <playlist id="playlist3">
  <property name="kdenlive:audio_track">1</property>
{pl3}
 </playlist>
 <tractor id="tractor1" in="00:00:00.000" out="{out_tc}">
  <property name="kdenlive:audio_track">1</property>
  <property name="kdenlive:trackheight">84</property>
  <property name="kdenlive:timeline_active">1</property>
  <track hide="video" producer="playlist2" />
 </tractor>
 <tractor id="tractor2" in="00:00:00.000" out="{out_tc}">
  <property name="kdenlive:trackheight">84</property>
  <property name="kdenlive:timeline_active">1</property>
  <track hide="audio" producer="playlist3" />
 </tractor>
 <tractor id="tractor3" in="00:00:00.000" out="{out_tc}">
  <property name="kdenlive:duration">{out_tc}</property>
  <property name="kdenlive:clipname">Sequence 1</property>
  <property name="kdenlive:uuid">{seq_uid}</property>
  <property name="kdenlive:sequenceproperties.subtitlesList">[
    {{
        "file": "{ass_name}",
        "id": 0,
        "name": "Subtitles"
    }}
]</property>
  <track producer="producer0" />
  <track producer="tractor1" />
  <track producer="tractor2" />
  <transition id="transition2">
   <property name="a_track">0</property>
   <property name="b_track">1</property>
   <property name="mlt_service">mix</property>
   <property name="kdenlive_id">mix</property>
   <property name="always_active">1</property>
   <property name="accepts_blanks">1</property>
   <property name="sum">1</property>
  </transition>
  <transition id="transition3">
   <property name="a_track">0</property>
   <property name="b_track">2</property>
   <property name="compositing">0</property>
   <property name="mlt_service">qtblend</property>
   <property name="kdenlive_id">qtblend</property>
   <property name="always_active">1</property>
  </transition>
 </tractor>
 <playlist id="main_bin">
  <property name="kdenlive:docproperties.uuid">{seq_uid}</property>
  <property name="kdenlive:docproperties.kdenliveversion">25.04.2</property>
 </playlist>
</mlt>
"""
    out.write_text(xml, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", type=Path, required=True)
    ap.add_argument("--subs", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--remove-ranges-json", type=Path)
    ap.add_argument("--keep-full-timeline", action="store_true")
    ap.add_argument("--snap", action="store_true")
    ap.add_argument("--join-fade-sec", type=float, default=0.0)
    ap.add_argument("--join-fade-min-gap", type=float, default=72.0)
    args = ap.parse_args()

    video = args.video.resolve()
    subs = args.subs.resolve()
    out = args.out.resolve()
    if not video.exists():
        raise SystemExit(f"missing video: {video}")
    if not subs.exists():
        raise SystemExit(f"missing subs: {subs}")

    cues = parse_srt(subs)
    duration = probe_duration(video)
    meta = probe_video_meta(video)

    removals: list[Range] = []
    if args.remove_ranges_json:
        removals = parse_remove_json(args.remove_ranges_json)
        if args.snap:
            removals = snap_removal_edges_to_keyframes_meta(removals, video)

    if args.keep_full_timeline:
        segments = segments_from_subs(cues, duration)
    else:
        segments = [(0.0, duration)]

    kept = subtract_ranges(segments, removals)
    if not kept:
        raise SystemExit("no segments left after removals")

    root = out.parent
    ass_name = out.name + ".ass"
    write_kdenlive(
        out,
        video,
        kept,
        meta,
        root,
        ass_name,
        args.join_fade_sec,
        args.join_fade_min_gap,
        removals,
    )
    # Shifted subs use playlist2 timecodes (frame-rounded), not pre-round floats.
    kept_pl = parse_playlist2_segments(out)
    shifted_srt = out.with_suffix(out.suffix + ".shifted.srt")
    ass_path = out.with_suffix(out.suffix + ".ass")
    shifted_srt.write_text(build_shifted_srt(cues, kept_pl), encoding="utf-8")
    ass_path.write_text(build_ass(cues, kept_pl), encoding="utf-8")
    kept = kept_pl
    print(
        f"Wrote {out} ({len(kept)} segments, output ~{sum(b - a for a, b in kept):.1f}s)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
