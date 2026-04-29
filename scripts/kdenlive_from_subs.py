#!/usr/bin/env python3
from __future__ import annotations

import argparse
import bisect
import dataclasses
import json
import os
import re
import subprocess
import sys
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterable, List, Optional, Tuple


@dataclasses.dataclass(frozen=True)
class Cue:
    start: float
    end: float
    text: str


@dataclasses.dataclass(frozen=True)
class Span:
    start: float
    end: float
    kind: str  # "dialog" | "non_dialog"


@dataclasses.dataclass(frozen=True)
class Segment:
    start: float
    end: float
    note: str = ""


TIME_RE = re.compile(
    r"(?P<h>\d{2}):(?P<m>\d{2}):(?P<s>\d{2}),(?P<ms>\d{3})\s*-->\s*"
    r"(?P<h2>\d{2}):(?P<m2>\d{2}):(?P<s2>\d{2}),(?P<ms2>\d{3})"
)


def run(cmd: List[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def ffprobe_json(video: Path) -> dict:
    cp = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(video),
        ]
    )
    return json.loads(cp.stdout)


def parse_fraction(frac: str) -> Tuple[int, int]:
    if "/" in frac:
        a, b = frac.split("/", 1)
        return int(a), int(b)
    # sometimes "23.976"
    if "." in frac:
        # best-effort rationalization for common fps values
        v = float(frac)
        for num, den in [(24000, 1001), (30000, 1001), (60000, 1001), (25, 1), (24, 1), (30, 1), (50, 1), (60, 1)]:
            if abs(v - (num / den)) < 1e-3:
                return num, den
        return int(round(v * 1000)), 1000
    return int(frac), 1


def video_profile(probe: dict) -> dict:
    vstreams = [s for s in probe.get("streams", []) if s.get("codec_type") == "video"]
    if not vstreams:
        raise SystemExit("ffprobe: no video stream found")
    v0 = vstreams[0]
    width = int(v0["width"])
    height = int(v0["height"])
    # prefer avg_frame_rate if present
    fr = v0.get("avg_frame_rate") or v0.get("r_frame_rate") or "24000/1001"
    fr_num, fr_den = parse_fraction(fr)
    duration = float(probe.get("format", {}).get("duration") or 0.0)
    if duration <= 0:
        # fallback from stream
        duration = float(v0.get("duration") or 0.0)
    if duration <= 0:
        raise SystemExit("ffprobe: could not determine duration")
    colorspace = "709"
    # Kdenlive/MLT profile expects colorspace int-like string, but existing files use 709/2020.
    # We'll keep 709 unless explicitly present.
    cs = v0.get("color_space")
    if cs in ("bt2020nc", "bt2020c"):
        colorspace = "2020"
    return {
        "width": width,
        "height": height,
        "frame_rate_num": fr_num,
        "frame_rate_den": fr_den,
        "duration": duration,
        "colorspace": colorspace,
    }


def srt_time_to_seconds(h: str, m: str, s: str, ms: str) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0


def parse_srt(path: Path) -> List[Cue]:
    cues: List[Cue] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    i = 0
    while i < len(lines):
        # skip blank lines
        if not lines[i].strip():
            i += 1
            continue
        # optional numeric index
        if lines[i].strip().isdigit():
            i += 1
            if i >= len(lines):
                break
        if i >= len(lines):
            break
        m = TIME_RE.match(lines[i].strip())
        if not m:
            # move on
            i += 1
            continue
        start = srt_time_to_seconds(m["h"], m["m"], m["s"], m["ms"])
        end = srt_time_to_seconds(m["h2"], m["m2"], m["s2"], m["ms2"])
        i += 1
        text_lines: List[str] = []
        while i < len(lines) and lines[i].strip():
            text_lines.append(lines[i])
            i += 1
        text = "\n".join(text_lines).strip()
        cues.append(Cue(start=start, end=end, text=text))
        i += 1
    return cues


TAG_RE = re.compile(r"<[^>]+>")


def normalize_text(t: str) -> str:
    t = TAG_RE.sub("", t)
    t = t.strip()
    return t


BRACKET_CUE_RE = re.compile(r"^\s*\[[^\]]+\]\s*$")


def is_dialogue(text: str, include_bracket_cues: bool) -> bool:
    t = normalize_text(text)
    if not t:
        return False
    if include_bracket_cues:
        return True
    # exclude pure bracket cues like [Music]
    # allow bracket cues if they contain other text on same line
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    if not lines:
        return False
    if all(BRACKET_CUE_RE.match(ln) for ln in lines):
        return False
    return True


def cues_to_spans(cues: List[Cue], include_bracket_cues: bool) -> List[Span]:
    spans: List[Span] = []
    for c in cues:
        kind = "dialog" if is_dialogue(c.text, include_bracket_cues) else "non_dialog"
        spans.append(Span(start=c.start, end=c.end, kind=kind))
    return spans


def merge_spans(spans: List[Span], max_gap: float) -> List[Span]:
    if not spans:
        return []
    spans_sorted = sorted(spans, key=lambda s: (s.start, s.end))
    merged: List[Span] = []
    cur = spans_sorted[0]
    for s in spans_sorted[1:]:
        if s.kind == cur.kind and s.start <= cur.end + max_gap:
            cur = Span(start=cur.start, end=max(cur.end, s.end), kind=cur.kind)
        else:
            merged.append(cur)
            cur = s
    merged.append(cur)
    return merged


def build_dialog_boundaries(
    spans: List[Span], pad_in: float, pad_out: float, duration: float
) -> List[Tuple[float, float]]:
    """
    Returns list of padded [start,end] dialog spans, non-overlapping, clamped to [0,duration].
    Only spans with kind=="dialog" are included.
    """
    dialogs = [s for s in spans if s.kind == "dialog" and s.end > s.start]
    dialogs = sorted(dialogs, key=lambda s: s.start)
    padded: List[List[float]] = []
    for d in dialogs:
        a = max(0.0, d.start - pad_in)
        b = min(duration, d.end + pad_out)
        if b <= a:
            continue
        padded.append([a, b])

    if not padded:
        return []

    # enforce non-overlap by shrinking locally (never reorders)
    out: List[Tuple[float, float]] = []
    prev_a, prev_b = padded[0]
    for a, b in padded[1:]:
        if a < prev_b:
            # overlap: split the difference at midpoint
            mid = (prev_b + a) / 2.0
            # shrink prev end and current start to meet at mid
            prev_b2 = max(prev_a, min(prev_b, mid))
            a2 = min(b, max(a, mid))
            prev_b = prev_b2
            a = a2
        out.append((prev_a, prev_b))
        prev_a, prev_b = a, b
    out.append((prev_a, prev_b))

    # clamp monotonic + remove degenerate
    cleaned: List[Tuple[float, float]] = []
    last_end = 0.0
    for a, b in out:
        a = max(0.0, min(duration, a))
        b = max(0.0, min(duration, b))
        a = max(a, last_end)  # ensure non-decreasing
        if b > a:
            cleaned.append((a, b))
            last_end = b
    return cleaned


def boundaries_to_segments(boundaries: List[Tuple[float, float]], duration: float) -> List[Segment]:
    """
    Convert padded dialog spans into full coverage consecutive segments:
      0 -> start1
      start1 -> end1
      end1 -> start2
      ...
      endN -> duration
    """
    segs: List[Segment] = []
    t = 0.0
    for a, b in boundaries:
        if a > t:
            segs.append(Segment(start=t, end=a, note="gap"))
        segs.append(Segment(start=a, end=b, note="dialog"))
        t = b
    if t < duration:
        segs.append(Segment(start=t, end=duration, note="tail"))
    # drop tiny segments
    segs2 = [s for s in segs if s.end - s.start >= 0.01]
    return segs2


def seconds_to_timecode(sec: float) -> str:
    if sec < 0:
        sec = 0.0
    ms = int(round((sec - int(sec)) * 1000))
    total = int(sec)
    s = total % 60
    m = (total // 60) % 60
    h = total // 3600
    if ms == 1000:
        ms = 0
        s += 1
    if s >= 60:
        s = 0
        m += 1
    if m >= 60:
        m = 0
        h += 1
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def ensure_ass(subs_path: Path, ass_out: Path) -> None:
    # Use ffmpeg conversion for correctness (styles, italics, etc.)
    ass_out.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-y", "-v", "error", "-i", str(subs_path), str(ass_out)])

def write_srt(cues: List[Cue], out_path: Path) -> None:
    out_lines: List[str] = []
    for idx, c in enumerate(cues, start=1):
        def fmt(tc: float) -> str:
            h = int(tc // 3600)
            m = int((tc % 3600) // 60)
            s = int(tc % 60)
            ms = int(round((tc - int(tc)) * 1000))
            if ms == 1000:
                ms = 0
                s += 1
            return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

        out_lines.append(str(idx))
        out_lines.append(f"{fmt(c.start)} --> {fmt(c.end)}")
        out_lines.append(c.text)
        out_lines.append("")
    out_path.write_text("\n".join(out_lines), encoding="utf-8")


def parse_time_arg(s: str) -> float:
    """
    Accepts seconds as float (e.g. '123.45') or timecode 'HH:MM:SS.mmm'.
    """
    s = s.strip()
    if not s:
        raise ValueError("empty time")
    if re.fullmatch(r"\d+(\.\d+)?", s):
        return float(s)
    m = re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?", s)
    if not m:
        raise ValueError(f"invalid time: {s}")
    h = int(m.group(1))
    mi = int(m.group(2))
    se = int(m.group(3))
    ms = int((m.group(4) or "0").ljust(3, "0"))
    return h * 3600 + mi * 60 + se + ms / 1000.0


def merge_time_ranges(ranges: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    if not ranges:
        return []
    cleaned = []
    for a, b in ranges:
        if b <= a:
            continue
        cleaned.append((float(a), float(b)))
    cleaned.sort(key=lambda x: x[0])
    merged: List[List[float]] = [[cleaned[0][0], cleaned[0][1]]]
    for a, b in cleaned[1:]:
        if a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return [(float(x[0]), float(x[1])) for x in merged]


def keep_segments_from_removals(source_duration: float, removals: List[Tuple[float, float]]) -> List[Segment]:
    """Source-domain keep segments when removing merged ranges [start,end)."""
    removals = merge_time_ranges(removals)
    removals = [(max(0.0, a), min(b, source_duration)) for a, b in removals]
    removals = [(a, b) for a, b in removals if b > a]
    if not removals:
        return [Segment(start=0.0, end=source_duration, note="full")]
    segs: List[Segment] = []
    t = 0.0
    for a, b in removals:
        if a > t:
            segs.append(Segment(start=t, end=a, note="keep"))
        t = max(t, b)
    if t < source_duration:
        segs.append(Segment(start=t, end=source_duration, note="keep"))
    return [s for s in segs if s.end - s.start >= 0.01]


def apply_cuts_to_cues_multi(cues: List[Cue], removals: List[Tuple[float, float]]) -> List[Cue]:
    """Apply removals in descending cut_start order so source timestamps stay valid."""
    m = merge_time_ranges(removals)
    out = cues
    for cs, ce in sorted(m, key=lambda x: -x[0]):
        out = apply_cut_to_cues(out, cs, ce)
    return out


def load_remove_ranges_json(path: Path) -> List[Tuple[float, float]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and "ranges" in raw:
        raw = raw["ranges"]
    if not isinstance(raw, list):
        raise SystemExit("--remove-ranges-json must be a JSON array or {\"ranges\": [...]}")
    out: List[Tuple[float, float]] = []
    for item in raw:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            out.append((float(item[0]), float(item[1])))
        else:
            raise SystemExit(f"Invalid range entry in JSON: {item!r}")
    return out


def apply_cut_to_cues(cues: List[Cue], cut_start: float, cut_end: float) -> List[Cue]:
    """
    Remove cues that fall inside [cut_start, cut_end).
    Shift all cues after cut_end earlier by (cut_end - cut_start).
    """
    if cut_end <= cut_start:
        return cues
    delta = cut_end - cut_start
    out: List[Cue] = []
    for c in cues:
        if c.end <= cut_start:
            out.append(c)
            continue
        if c.start >= cut_end:
            out.append(Cue(start=c.start - delta, end=c.end - delta, text=c.text))
            continue
        # overlaps cut: drop it (KidFriendly hard remove)
    return out


def try_download_subs_with_subliminal(video: Path, lang: str, out_srt: Path) -> bool:
    try:
        import subliminal  # type: ignore
        from babelfish import Language  # type: ignore
    except Exception:
        return False

    # Use subliminal library directly (no creds by default; works with some providers if configured)
    try:
        videos = subliminal.scan_videos([str(video)])
        if not videos:
            return False
        best = subliminal.download_best_subtitles(videos, {Language.fromietf(lang)})
        subliminal.save_subtitles(videos, single=True, directory=str(out_srt.parent))
        # subliminal chooses filename; if our desired path doesn't exist, try to find any .srt next to video
        if out_srt.exists():
            return True
        cand = list(out_srt.parent.glob(video.stem + "*.srt"))
        if cand:
            cand[0].rename(out_srt)
            return True
        # last resort: any srt in directory
        any_srt = list(out_srt.parent.glob("*.srt"))
        if any_srt:
            any_srt[0].rename(out_srt)
            return True
        return False
    except Exception:
        return False


def pick_subtitle_file(video: Path, subs_mode: str, lang: str) -> Path:
    if subs_mode != "auto":
        p = Path(subs_mode)
        if not p.exists():
            raise SystemExit(f"subtitle file not found: {p}")
        return p

    # common sidecar names
    candidates = []
    for ext in [".srt", ".ass", ".vtt"]:
        p = video.with_suffix(ext)
        if p.exists():
            candidates.append(p)
    if candidates:
        return candidates[0]

    # any subs in same folder
    folder = video.parent
    for ext in ["*.srt", "*.ass", "*.vtt"]:
        hits = list(folder.glob(ext))
        if hits:
            return hits[0]

    # try subliminal if installed
    out_srt = video.with_suffix(".srt")
    ok = try_download_subs_with_subliminal(video, lang=lang, out_srt=out_srt)
    if ok and out_srt.exists():
        return out_srt

    raise SystemExit(
        "No subtitles found next to video, and could not download via subliminal.\n"
        "Install subliminal (and configure providers if needed), or pass --subs /path/to/file.srt"
    )


def ffprobe_keyframes(video: Path) -> List[float]:
    # Keyframes only; this is usually manageable.
    cp = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-skip_frame",
            "nokey",
            "-select_streams",
            "v:0",
            "-show_frames",
            "-show_entries",
            "frame=best_effort_timestamp_time",
            "-of",
            "csv=p=0",
            str(video),
        ]
    )
    out: List[float] = []
    for ln in cp.stdout.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        try:
            out.append(float(ln))
        except ValueError:
            continue
    out.sort()
    return out


def snap_to_nearest(sorted_times: List[float], t: float, window: float) -> Optional[float]:
    if not sorted_times:
        return None
    i = bisect.bisect_left(sorted_times, t)
    candidates = []
    if i < len(sorted_times):
        candidates.append(sorted_times[i])
    if i > 0:
        candidates.append(sorted_times[i - 1])
    best = None
    best_dt = None
    for c in candidates:
        dt = abs(c - t)
        if dt <= window and (best_dt is None or dt < best_dt):
            best = c
            best_dt = dt
    return best


def apply_snapping(
    boundaries: List[Tuple[float, float]],
    keyframes: List[float],
    window: float,
) -> Tuple[List[Tuple[float, float]], List[dict]]:
    """
    Snap boundary start/end points to nearby keyframes (within window).
    Returns snapped boundaries and per-boundary debug records.
    """
    debug: List[dict] = []
    snapped: List[Tuple[float, float]] = []
    last_end = 0.0
    for a, b in boundaries:
        a0, b0 = a, b
        a1 = snap_to_nearest(keyframes, a, window) or a
        b1 = snap_to_nearest(keyframes, b, window) or b
        # enforce monotonic, non-degenerate
        a1 = max(a1, last_end)
        if b1 <= a1:
            b1 = max(b1, a1 + 0.01)
        snapped.append((a1, b1))
        last_end = b1
        debug.append(
            {
                "start_in": a0,
                "end_in": b0,
                "start_out": a1,
                "end_out": b1,
                "start_snapped": a1 != a0,
                "end_snapped": b1 != b0,
            }
        )
    return snapped, debug


def build_kdenlive_project(
    *,
    video: Path,
    profile: dict,
    source_duration: float,
    timeline_duration: float,
    segments: List[Segment],
    ass_filename: str,
    project_root: str,
    doc_uuid: str,
    fade_to_black: Optional[Tuple[float, float]] = None,
    fade_from_black: Optional[Tuple[float, float]] = None,
) -> ET.ElementTree:
    """
    Builds a Kdenlive .kdenlive file shaped like the simpler KidFriendly projects:
    - one media chain producer
    - one audio tractor + one video tractor
    - master tractor with subtitles filter
    """
    mlt = ET.Element(
        "mlt",
        {
            "LC_NUMERIC": "en_US.UTF-8",
            "producer": "main_bin",
            "root": project_root,
            "version": "7.33.0",
        },
    )

    ET.SubElement(
        mlt,
        "profile",
        {
            "colorspace": str(profile["colorspace"]),
            "description": f'{profile["width"]}x{profile["height"]} {profile["frame_rate_num"]/profile["frame_rate_den"]:.2f}fps',
            "display_aspect_num": "1",
            "display_aspect_den": "1",
            "frame_rate_num": str(profile["frame_rate_num"]),
            "frame_rate_den": str(profile["frame_rate_den"]),
            "height": str(profile["height"]),
            "progressive": "1",
            "sample_aspect_num": "1",
            "sample_aspect_den": "1",
            "width": str(profile["width"]),
        },
    )

    timeline_tc = seconds_to_timecode(timeline_duration)
    source_tc = seconds_to_timecode(source_duration)
    fps = profile["frame_rate_num"] / profile["frame_rate_den"]
    source_frames = int(round(source_duration * fps))

    # black background producer
    producer0 = ET.SubElement(mlt, "producer", {"id": "producer0", "in": "00:00:00.000", "out": timeline_tc})
    for k, v in [
        ("length", "2147483647"),
        ("eof", "continue"),
        ("resource", "black"),
        ("aspect_ratio", "1"),
        ("mlt_service", "color"),
        ("kdenlive:playlistid", "black_track"),
        ("mlt_image_format", "rgba"),
        ("set.test_audio", "0"),
    ]:
        ET.SubElement(producer0, "property", {"name": k}).text = str(v)

    # empty playlists referenced by tractor0 (audio monitor config in existing projects)
    ET.SubElement(mlt, "playlist", {"id": "playlist0"})
    ET.SubElement(mlt, "playlist", {"id": "playlist1"})

    tractor0 = ET.SubElement(mlt, "tractor", {"id": "tractor0", "in": "00:00:00.000"})
    for k, v in [
        ("kdenlive:audio_track", "1"),
        ("kdenlive:trackheight", "84"),
        ("kdenlive:timeline_active", "1"),
    ]:
        ET.SubElement(tractor0, "property", {"name": k}).text = v
    ET.SubElement(tractor0, "track", {"hide": "video", "producer": "playlist0"})
    ET.SubElement(tractor0, "track", {"hide": "video", "producer": "playlist1"})

    # media chain
    chain0 = ET.SubElement(mlt, "chain", {"id": "chain0", "out": source_tc})
    for k, v in [
        ("length", str(source_frames)),
        ("eof", "pause"),
        ("resource", str(video)),
        ("mlt_service", "avformat-novalidate"),
        ("seekable", "1"),
        ("audio_index", "0"),
        ("video_index", "0"),
        ("vstream", "0"),
        ("astream", "0"),
        ("kdenlive:control_uuid", "{" + str(uuid.uuid4()) + "}"),
        ("kdenlive:id", "5"),
        ("kdenlive:clip_type", "0"),
        ("kdenlive:folderid", "-1"),
    ]:
        ET.SubElement(chain0, "property", {"name": k}).text = str(v)

    # playlist for audio and video (single stream)
    playlist_audio = ET.SubElement(mlt, "playlist", {"id": "playlist2"})
    ET.SubElement(playlist_audio, "property", {"name": "kdenlive:audio_track"}).text = "1"

    playlist_video = ET.SubElement(mlt, "playlist", {"id": "playlist3"})
    ET.SubElement(playlist_video, "property", {"name": "kdenlive:audio_track"}).text = "1"

    for idx, seg in enumerate(segments):
        a = seconds_to_timecode(seg.start)
        b = seconds_to_timecode(seg.end)
        e1 = ET.SubElement(playlist_audio, "entry", {"in": a, "out": b, "producer": "chain0"})
        ET.SubElement(e1, "property", {"name": "kdenlive:id"}).text = "5"
        e2 = ET.SubElement(playlist_video, "entry", {"in": a, "out": b, "producer": "chain0"})
        ET.SubElement(e2, "property", {"name": "kdenlive:id"}).text = "5"

        # Optional fades for a cut join (source-domain times like existing projects).
        if fade_to_black and idx == 0:
            f_in, f_out = fade_to_black
            f = ET.SubElement(e2, "filter", {"id": f"filter_v_out", "in": seconds_to_timecode(f_in), "out": seconds_to_timecode(f_out)})
            for k, v in [
                ("start", "1"),
                ("level", "1"),
                ("mlt_service", "brightness"),
                ("kdenlive_id", "fade_to_black"),
                ("alpha", f"00:00:00.000=1;{seconds_to_timecode(f_out - f_in)}=0"),
            ]:
                ET.SubElement(f, "property", {"name": k}).text = v
            fa = ET.SubElement(e1, "filter", {"id": f"filter_a_out", "in": seconds_to_timecode(f_in), "out": seconds_to_timecode(f_out)})
            for k, v in [
                ("window", "75"),
                ("max_gain", "20dB"),
                ("mlt_service", "volume"),
                ("kdenlive_id", "fadeout"),
                ("gain", "1"),
                ("end", "0"),
                ("kdenlive:collapsed", "0"),
            ]:
                ET.SubElement(fa, "property", {"name": k}).text = v

        if fade_from_black and idx == 1:
            f_in, f_out = fade_from_black
            f = ET.SubElement(e2, "filter", {"id": f"filter_v_in", "in": seconds_to_timecode(f_in), "out": seconds_to_timecode(f_out)})
            for k, v in [
                ("start", "1"),
                ("level", "1"),
                ("mlt_service", "brightness"),
                ("kdenlive_id", "fade_from_black"),
                ("alpha", f"00:00:00.000=0;{seconds_to_timecode(f_out - f_in)}=1"),
            ]:
                ET.SubElement(f, "property", {"name": k}).text = v
            fa = ET.SubElement(e1, "filter", {"id": f"filter_a_in", "in": seconds_to_timecode(f_in), "out": seconds_to_timecode(f_out)})
            for k, v in [
                ("window", "75"),
                ("max_gain", "20dB"),
                ("mlt_service", "volume"),
                ("kdenlive_id", "fadein"),
                ("gain", "0"),
                ("end", "1"),
            ]:
                ET.SubElement(fa, "property", {"name": k}).text = v

    # tractor1: audio timeline
    tractor1 = ET.SubElement(mlt, "tractor", {"id": "tractor1", "in": "00:00:00.000", "out": timeline_tc})
    for k, v in [
        ("kdenlive:audio_track", "1"),
        ("kdenlive:trackheight", "84"),
        ("kdenlive:timeline_active", "1"),
        ("kdenlive:collapsed", "0"),
        ("kdenlive:thumbs_format", ""),
        ("kdenlive:audio_rec", ""),
    ]:
        ET.SubElement(tractor1, "property", {"name": k}).text = v
    ET.SubElement(tractor1, "track", {"hide": "video", "producer": "playlist2"})

    # tractor2: video timeline
    tractor2 = ET.SubElement(mlt, "tractor", {"id": "tractor2", "in": "00:00:00.000", "out": timeline_tc})
    for k, v in [
        ("kdenlive:trackheight", "84"),
        ("kdenlive:timeline_active", "1"),
        ("kdenlive:collapsed", "0"),
        ("kdenlive:thumbs_format", ""),
        ("kdenlive:audio_rec", ""),
    ]:
        ET.SubElement(tractor2, "property", {"name": k}).text = v
    ET.SubElement(tractor2, "track", {"hide": "audio", "producer": "playlist3"})

    # master tractor with subtitles filter + sequence properties
    master = ET.SubElement(mlt, "tractor", {"id": "tractor3", "in": "00:00:00.000", "out": timeline_tc})
    ET.SubElement(master, "property", {"name": "kdenlive:duration"}).text = timeline_tc
    ET.SubElement(master, "property", {"name": "kdenlive:clipname"}).text = "Sequence 1"
    ET.SubElement(master, "property", {"name": "kdenlive:uuid"}).text = "{" + doc_uuid + "}"
    ET.SubElement(master, "property", {"name": "kdenlive:producer_type"}).text = "17"
    ET.SubElement(master, "property", {"name": "kdenlive:control_uuid"}).text = "{" + doc_uuid + "}"
    ET.SubElement(master, "property", {"name": "kdenlive:id"}).text = "3"
    ET.SubElement(master, "property", {"name": "kdenlive:clip_type"}).text = "0"
    ET.SubElement(master, "property", {"name": "kdenlive:sequenceproperties.hidesubtitle"}).text = "0"
    ET.SubElement(master, "property", {"name": "kdenlive:sequenceproperties.tracks"}).text = "2"
    ET.SubElement(master, "property", {"name": "kdenlive:sequenceproperties.tracksCount"}).text = "2"
    ET.SubElement(master, "property", {"name": "kdenlive:sequenceproperties.subtitlesList"}).text = json.dumps(
        [{"file": ass_filename, "id": 0, "name": "Subtitles"}], indent=4
    )

    ET.SubElement(master, "track", {"producer": "producer0"})
    ET.SubElement(master, "track", {"producer": "tractor1"})
    ET.SubElement(master, "track", {"producer": "tractor2"})

    # transitions are optional but help Kdenlive treat tracks sensibly
    tr_mix1 = ET.SubElement(master, "transition", {"id": "transition2"})
    for k, v in [
        ("a_track", "0"),
        ("b_track", "1"),
        ("mlt_service", "mix"),
        ("kdenlive_id", "mix"),
        ("internal_added", "237"),
        ("always_active", "1"),
        ("accepts_blanks", "1"),
        ("sum", "1"),
    ]:
        ET.SubElement(tr_mix1, "property", {"name": k}).text = v

    tr_qt = ET.SubElement(master, "transition", {"id": "transition3"})
    for k, v in [
        ("a_track", "0"),
        ("b_track", "2"),
        ("compositing", "0"),
        ("distort", "0"),
        ("rotate_center", "0"),
        ("mlt_service", "qtblend"),
        ("kdenlive_id", "qtblend"),
        ("internal_added", "237"),
        ("always_active", "1"),
    ]:
        ET.SubElement(tr_qt, "property", {"name": k}).text = v

    # subtitles filter
    filt = ET.SubElement(master, "filter", {"id": "filter8"})
    for k, v in [
        ("mlt_service", "avfilter.subtitles"),
        ("av.alpha", "1"),
        ("internal_added", "237"),
        ("av.filename", ass_filename),
        ("disable", "1"),
    ]:
        ET.SubElement(filt, "property", {"name": k}).text = v

    # minimal main_bin so Kdenlive can open project
    main_bin = ET.SubElement(mlt, "playlist", {"id": "main_bin"})
    ET.SubElement(main_bin, "property", {"name": "kdenlive:docproperties.uuid"}).text = "{" + doc_uuid + "}"
    ET.SubElement(main_bin, "property", {"name": "kdenlive:docproperties.kdenliveversion"}).text = "25.04.2"
    ET.SubElement(main_bin, "property", {"name": "kdenlive:docproperties.documentid"}).text = str(int(1000 * float(os.times().elapsed)))

    return ET.ElementTree(mlt)


def indent(elem: ET.Element, level: int = 0) -> None:
    i = "\n" + level * " "
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = i + " "
        for e in elem:
            indent(e, level + 1)
        if not elem.tail or not elem.tail.strip():
            elem.tail = i
    else:
        if level and (not elem.tail or not elem.tail.strip()):
            elem.tail = i


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description="Generate Kdenlive .kdenlive from subtitle dialog timings.")
    ap.add_argument("--video", required=True, help="Path to video file")
    ap.add_argument("--subs", default="auto", help="Subtitle file path, or 'auto' (default)")
    ap.add_argument("--lang", default="en", help="Language for subliminal download (ietf, default: en)")
    ap.add_argument("--include-bracket-cues", action="store_true", help="Treat [Music] etc as dialog for boundaries")
    ap.add_argument("--merge-gap", type=float, default=0.25, help="Merge adjacent spans with gap <= this (sec)")
    ap.add_argument("--pad-in", type=float, default=0.25)
    ap.add_argument("--pad-out", type=float, default=0.35)
    ap.add_argument("--snap", action="store_true", help="Snap boundaries to nearest keyframes")
    ap.add_argument("--snap-window", type=float, default=0.5, help="Snap window +/- seconds")
    ap.add_argument(
        "--remove-range",
        nargs=2,
        metavar=("START", "END"),
        action="append",
        default=None,
        help="Remove a source time range (sec or HH:MM:SS.mmm); repeat for multiple cuts",
    )
    ap.add_argument(
        "--remove-ranges-json",
        help="JSON file: [[start,end],...] or {\"ranges\":[[start,end],...]} (merged with --remove-range)",
    )
    ap.add_argument(
        "--keep-full-timeline",
        action="store_true",
        help="Do not compress to dialog-only spans; keep full source except explicit --remove-range(s)",
    )
    ap.add_argument("--fade", type=float, default=0.0, help="Fade duration (seconds) at cut join (single cut only)")
    ap.add_argument("--out", required=True, help="Output .kdenlive path")
    ap.add_argument("--debug-json", help="Optional debug JSON output path")
    args = ap.parse_args(argv)

    video = Path(args.video).expanduser().resolve()
    if not video.exists():
        raise SystemExit(f"video not found: {video}")

    subs = pick_subtitle_file(video, args.subs, lang=args.lang)
    cues = parse_srt(subs) if subs.suffix.lower() == ".srt" else []
    if not cues and subs.suffix.lower() != ".srt":
        # still allow conversion to ASS for burn-in, but boundaries need timing; for now only SRT supported
        raise SystemExit(f"Only .srt parsing is implemented right now (got {subs.suffix}).")

    probe = ffprobe_json(video)
    prof = video_profile(probe)
    source_duration = prof["duration"]
    timeline_duration = source_duration

    remove_pairs: List[Tuple[float, float]] = []
    if args.remove_ranges_json:
        remove_pairs.extend(load_remove_ranges_json(Path(args.remove_ranges_json).expanduser().resolve()))
    if args.remove_range:
        for pair in args.remove_range:
            remove_pairs.append((parse_time_arg(pair[0]), parse_time_arg(pair[1])))
    for cs, ce in remove_pairs:
        if cs < 0 or ce < 0 or ce <= cs:
            raise SystemExit("Each remove range must have START < END and both >= 0")
    remove_pairs = [(cs, min(ce, source_duration)) for cs, ce in remove_pairs]
    remove_pairs = [(cs, ce) for cs, ce in remove_pairs if ce > cs]
    cut_ranges_merged = merge_time_ranges(remove_pairs)
    if len(cut_ranges_merged) > 1 and not args.keep_full_timeline:
        raise SystemExit("Multiple --remove-range entries require --keep-full-timeline (dialog+multi-cut is unsupported).")

    cut_range: Optional[Tuple[float, float]] = None
    if len(cut_ranges_merged) == 1:
        cut_range = cut_ranges_merged[0]
    elif len(cut_ranges_merged) > 1:
        cut_range = None

    fade_to_black = None
    fade_from_black = None
    boundaries: List[Tuple[float, float]] = []
    snap_debug: List[dict] = []

    if args.keep_full_timeline:
        if cut_ranges_merged:
            timeline_duration = source_duration - sum(b - a for a, b in cut_ranges_merged)
            segments = keep_segments_from_removals(source_duration, cut_ranges_merged)
            cues = apply_cuts_to_cues_multi(cues, cut_ranges_merged)
            if args.fade > 0 and len(cut_ranges_merged) == 1:
                cs, ce = cut_ranges_merged[0]
                f = min(args.fade, max(0.0, cs))
                fade_to_black = (max(0.0, cs - f), cs)
                fade_from_black = (ce, min(ce + f, source_duration))
        else:
            segments = [Segment(start=0.0, end=source_duration, note="full")]
    else:
        if cut_ranges_merged:
            cs, ce = cut_ranges_merged[0]
            cues = apply_cut_to_cues(cues, cs, ce)
            timeline_duration = source_duration - (ce - cs)
        spans = cues_to_spans(cues, include_bracket_cues=args.include_bracket_cues)
        spans = merge_spans(spans, max_gap=args.merge_gap)
        boundaries = build_dialog_boundaries(spans, pad_in=args.pad_in, pad_out=args.pad_out, duration=timeline_duration)
        if args.snap and boundaries:
            keyframes = ffprobe_keyframes(video)
            boundaries, snap_debug = apply_snapping(boundaries, keyframes=keyframes, window=args.snap_window)
        segments = boundaries_to_segments(boundaries, duration=timeline_duration)
        if cut_ranges_merged:
            cs, ce = cut_ranges_merged[0]
            segments = [
                Segment(start=0.0, end=cs, note="keep_pre_cut"),
                Segment(start=ce, end=source_duration, note="keep_post_cut"),
            ]
            if args.fade > 0:
                f = min(args.fade, max(0.0, cs))
                fade_to_black = (max(0.0, cs - f), cs)
                fade_from_black = (ce, min(ce + f, source_duration))

    out_kdenlive = Path(args.out).expanduser().resolve()
    out_kdenlive.parent.mkdir(parents=True, exist_ok=True)
    ass_out = out_kdenlive.with_suffix(out_kdenlive.suffix + ".ass")
    subs_for_ass = subs
    if cut_ranges_merged:
        shifted_srt = out_kdenlive.with_suffix(out_kdenlive.suffix + ".shifted.srt")
        write_srt(cues, shifted_srt)
        subs_for_ass = shifted_srt
    ensure_ass(subs_for_ass, ass_out)

    doc_uuid = str(uuid.uuid4())
    tree = build_kdenlive_project(
        video=video,
        profile=prof,
        source_duration=source_duration,
        timeline_duration=timeline_duration,
        segments=segments,
        ass_filename=ass_out.name,
        project_root=str(out_kdenlive.parent),
        doc_uuid=doc_uuid,
        fade_to_black=fade_to_black,
        fade_from_black=fade_from_black,
    )
    indent(tree.getroot())
    tree.write(out_kdenlive, encoding="utf-8", xml_declaration=True)

    if args.debug_json:
        dbg = {
            "video": str(video),
            "subs": str(subs),
            "source_duration": source_duration,
            "timeline_duration": timeline_duration,
            "pad_in": args.pad_in,
            "pad_out": args.pad_out,
            "snap": bool(args.snap),
            "snap_window": args.snap_window,
            "dialog_boundaries": [{"start": a, "end": b} for a, b in boundaries],
            "snap_debug": snap_debug,
            "segments": [{"start": s.start, "end": s.end, "note": s.note} for s in segments],
            "cut_ranges": [{"start": a, "end": b} for a, b in cut_ranges_merged],
            "cut_range": {"start": cut_range[0], "end": cut_range[1]} if cut_range else None,
            "fade_to_black": {"in": fade_to_black[0], "out": fade_to_black[1]} if fade_to_black else None,
            "fade_from_black": {"in": fade_from_black[0], "out": fade_from_black[1]} if fade_from_black else None,
        }
        Path(args.debug_json).write_text(json.dumps(dbg, indent=2), encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

