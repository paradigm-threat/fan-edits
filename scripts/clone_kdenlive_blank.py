#!/usr/bin/env python3
"""
Clone a known-good Kdenlive blank (full-timeline A/V, opens in GUI) onto a new rip.

Do NOT invent .kdenlive XML from scratch — generated files often fail to open.
Start from a project Kdenlive created itself (reference: FanMixes/The Mummy (1999) - Debugged/
The Mummy Debugged.kdenlive), then rewrite media paths and duration.
Never keep avfilter.subtitles burn-in; optional --srt only copies a sidecar for
Project → Subtitles → Import. By default enables Kdenlive proxy clips (auto-generate
on open) so 4K HEVC scrubs smoothly; final render still uses the original rip.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import uuid
from collections import Counter
from pathlib import Path


def probe(video: Path) -> dict:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size",
            "-show_entries",
            "stream=index,codec_type,codec_name,width,height,r_frame_rate,channels,sample_rate",
            "-show_entries",
            "stream_tags=language,title",
            "-of",
            "json",
            str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(proc.stdout)


def md5_file(path: Path, limit: int | None = None) -> str:
    """Full-file MD5 (Kdenlive stores this). Optional limit for smoke tests only."""
    h = hashlib.md5()
    with path.open("rb") as f:
        remaining = limit
        while True:
            chunk = f.read(1 << 20 if remaining is None else min(1 << 20, remaining))
            if not chunk:
                break
            h.update(chunk)
            if remaining is not None:
                remaining -= len(chunk)
                if remaining <= 0:
                    break
    return h.hexdigest()


def sec_to_tc(sec: float) -> str:
    if sec < 0:
        sec = 0.0
    h = int(sec // 3600)
    sec -= h * 3600
    m = int(sec // 60)
    sec -= m * 60
    return f"{h:02d}:{m:02d}:{sec:06.3f}"


def frames_for(duration: float, fps_num: int = 24000, fps_den: int = 1001) -> int:
    return int(round(duration * fps_num / fps_den))


def _strip_avfilter_subtitles(text: str) -> str:
    """Remove MLT burn-in subtitle filters from a .kdenlive document."""
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    i = 0
    while i < len(lines):
        if re.match(r"\s*<filter\b", lines[i]):
            block = [lines[i]]
            j = i + 1
            while j < len(lines):
                block.append(lines[j])
                if "</filter>" in lines[j]:
                    j += 1
                    break
                j += 1
            if "avfilter.subtitles" not in "".join(block):
                out.extend(block)
            i = j
            continue
        out.append(lines[i])
        i += 1
    return "".join(out)


# I-frame x264 proxies for scrubbing. Do NOT use -vsync 1 / -fps_mode cfr:
# that pads one extra frame vs the HEVC original, then every razor made on the
# proxy is one frame off when Kdenlive renders the 4K source.
DEFAULT_PROXY_PARAMS = (
    "-vf scale=%width:-2 -fps_mode passthrough -c:v libx264 -g 1 -bf 0 -vb 0 "
    "-crf 20 -preset veryfast -c:a aac -ab 128k"
)
DEFAULT_PROXY_WIDTH = 960


def _set_docprop(text: str, name: str, value: str) -> str:
    pat = rf'(<property name="kdenlive:docproperties\.{re.escape(name)}">)[^<]*(</property>)'
    if re.search(pat, text):
        return re.sub(pat, rf"\g<1>{value}\g<2>", text, count=1)
    # Insert before closing main_bin / document props if missing (rare on blank)
    anchor = '<property name="kdenlive:docproperties.version">'
    if anchor in text:
        return text.replace(
            anchor,
            f'<property name="kdenlive:docproperties.{name}">{value}</property>\n  {anchor}',
            1,
        )
    return text


def _enable_proxies(text: str, *, width: int = DEFAULT_PROXY_WIDTH) -> str:
    text = _set_docprop(text, "enableproxy", "1")
    text = _set_docprop(text, "generateproxy", "1")
    text = _set_docprop(text, "proxyminsize", "1000")
    text = _set_docprop(text, "proxyresize", str(width))
    text = _set_docprop(text, "proxyextension", "mp4")
    text = _set_docprop(text, "proxyparams", DEFAULT_PROXY_PARAMS)
    return text


def clone_blank(
    template: Path,
    out_kdenlive: Path,
    video: Path,
    *,
    subtitle_srt: Path | None = None,
    project_root: Path | None = None,
    enable_proxy: bool = True,
    proxy_width: int = DEFAULT_PROXY_WIDTH,
) -> None:
    video = video.resolve()
    if not video.is_file():
        raise SystemExit(f"missing video: {video}")
    if not template.is_file():
        raise SystemExit(f"missing template: {template}")

    meta = probe(video)
    duration = float(meta["format"]["duration"])
    size = int(meta["format"]["size"])
    vstreams = [s for s in meta["streams"] if s.get("codec_type") == "video"]
    if not vstreams:
        raise SystemExit("no video stream")
    vs = vstreams[0]
    width = int(vs["width"])
    height = int(vs["height"])
    fps = vs.get("r_frame_rate") or "24000/1001"
    fps_num, fps_den = (int(x) for x in fps.split("/"))

    length = frames_for(duration, fps_num, fps_den)
    # Inclusive out: last frame index as timecode (match Mummy blank style closely)
    out_tc = sec_to_tc((length - 1) * fps_den / fps_num)
    duration_prop = sec_to_tc(duration).replace(".", ":")  # kdenlive:duration uses :frames-ish; keep simple
    # Mummy blank uses kdenlive:duration like 02:04:49:02 — approximate from frames
    rem = length % fps_num
    # Prefer HH:MM:SS:FF style using 24fps-ish frame remainder
    frames_in_sec = int(round((duration % 1) * (fps_num / fps_den)))
    h = int(duration // 3600)
    m = int((duration % 3600) // 60)
    s = int(duration % 60)
    duration_colon = f"{h:02d}:{m:02d}:{s:02d}:{frames_in_sec:02d}"

    file_hash = md5_file(video)
    text = template.read_text(encoding="utf-8")

    # Old resource path(s) — replace every absolute path ending in the template's media
    old_resources = sorted(
        set(re.findall(r'resource">([^<]+\.(?:mkv|mp4|mov|m4v|webm))', text)),
        key=len,
        reverse=True,
    )
    if not old_resources:
        raise SystemExit("template has no media resource paths to rewrite")

    new_root = (project_root or out_kdenlive.parent).resolve()
    old_root_m = re.search(r'root="([^"]+)"', text)
    if old_root_m:
        text = text.replace(old_root_m.group(1), new_root.as_posix())

    for old in old_resources:
        text = text.replace(old, video.as_posix())

    # Duration / length / size / hash on chains and playlists.
    # IMPORTANT: the blank's black producer0 often has a *longer* out than the film.
    # Replace the *most common* non-zero out (film end on chains/playlists), not max().
    old_outs = re.findall(r'out="(\d{2}:\d{2}:\d{2}\.\d{3})"', text)

    def to_sec(tc: str) -> float:
        h, m, s = tc.split(":")
        return int(h) * 3600 + int(m) * 60 + float(s)

    nonzero = [o for o in old_outs if o != "00:00:00.000"]
    if nonzero:
        counts = Counter(nonzero)
        film_out = counts.most_common(1)[0][0]
        text = text.replace(f'out="{film_out}"', f'out="{out_tc}"')
        # Preserve black-producer padding past the film end when present
        for bo in sorted(set(nonzero) - {film_out}, key=to_sec, reverse=True):
            pad = max(0.0, to_sec(bo) - to_sec(film_out))
            new_black = sec_to_tc(to_sec(out_tc) + pad)
            text = text.replace(f'out="{bo}"', f'out="{new_black}"')

    # Stream duration markups left over from the template film
    text = re.sub(
        r'(<property name="meta\.attr\.\d+\.stream\.DURATION\.markup">)[^<]+(</property>)',
        rf"\g<1>{out_tc}000000\g<2>",
        text,
    )

    text = re.sub(
        r'(<property name="length">)\d+(</property>)',
        rf"\g<1>{length}\g<2>",
        text,
    )
    text = re.sub(
        r'(<property name="kdenlive:maxduration">)\d+(</property>)',
        rf"\g<1>{length}\g<2>",
        text,
    )
    text = re.sub(
        r'(<property name="kdenlive:file_size">)\d+(</property>)',
        rf"\g<1>{size}\g<2>",
        text,
    )
    text = re.sub(
        r'(<property name="kdenlive:file_hash">)[0-9a-fA-F]+(</property>)',
        rf"\g<1>{file_hash}\g<2>",
        text,
        count=3,  # clip hashes; leave sequence hash alone then rewrite uuids
    )
    text = re.sub(
        r'(<property name="kdenlive:duration">)[^<]+(</property>)',
        rf"\g<1>{duration_colon}\g<2>",
        text,
    )
    text = re.sub(
        r'(<property name="meta\.media\.width">)\d+(</property>)',
        rf"\g<1>{width}\g<2>",
        text,
    )
    text = re.sub(
        r'(<property name="meta\.media\.height">)\d+(</property>)',
        rf"\g<1>{height}\g<2>",
        text,
    )
    text = re.sub(
        r'(<property name="meta\.media\.0\.codec\.width">)\d+(</property>)',
        rf"\g<1>{width}\g<2>",
        text,
    )
    text = re.sub(
        r'(<property name="meta\.media\.0\.codec\.height">)\d+(</property>)',
        rf"\g<1>{height}\g<2>",
        text,
    )

    # Fresh document / sequence UUIDs so Kdenlive treats this as a new project
    new_uuid = str(uuid.uuid4())
    text = re.sub(
        r"\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}",
        "{" + new_uuid + "}",
        text,
    )
    text = re.sub(
        r'(kdenlive:docproperties\.documentid">)\d+',
        rf"\g<1>{int(__import__('time').time() * 1000)}",
        text,
    )
    # Clean playhead
    text = re.sub(
        r'(kdenlive:sequenceproperties\.position">)\d+',
        r"\g<1>0",
        text,
    )
    text = re.sub(
        r'(kdenlive:sequenceproperties\.scrollPos">)\d+',
        r"\g<1>0",
        text,
    )

    # Never keep burn-in subtitle filters — they tank 4K preview and aren't wanted.
    # Keep sidecar SRT for optional Project → Subtitles → Import / grouping.
    text = _strip_avfilter_subtitles(text)

    if enable_proxy:
        text = _enable_proxies(text, width=proxy_width)

    out_kdenlive.parent.mkdir(parents=True, exist_ok=True)
    out_kdenlive.write_text(text, encoding="utf-8")

    if subtitle_srt is not None:
        if not subtitle_srt.is_file():
            raise SystemExit(f"missing subtitle: {subtitle_srt}")
        dest = out_kdenlive.with_suffix(out_kdenlive.suffix + ".srt")  # foo.kdenlive.srt
        if subtitle_srt.resolve() != dest.resolve():
            shutil.copy2(subtitle_srt, dest)
        working = out_kdenlive.with_suffix(".srt")  # foo.srt
        if working.resolve() != subtitle_srt.resolve() and working.resolve() != dest.resolve():
            shutil.copy2(subtitle_srt, working)

    print(f"Wrote {out_kdenlive}")
    print(f"  video={video}")
    print(f"  duration={duration:.3f}s out={out_tc} length={length} frames")
    print(f"  size={size} hash={file_hash}")
    if enable_proxy:
        print(
            f"  proxies ON (auto-generate ≥1000px → {proxy_width}px I-frame x264; "
            "Kdenlive builds them on open)"
        )
    if subtitle_srt:
        print(f"  srt sidecar -> {out_kdenlive.name}.srt (import as subtitle track; no burn-in)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--template",
        type=Path,
        default=Path(
            "/home/ari/dev/fan-edits/FanMixes/The Mummy (1999) - Debugged/The Mummy Debugged.kdenlive"
        ),
    )
    ap.add_argument("--video", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True, help="Output .kdenlive path")
    ap.add_argument(
        "--srt",
        type=Path,
        help="English SRT sidecar next to the project (for Subtitle track import; not burned in)",
    )
    ap.add_argument(
        "--no-proxy",
        action="store_true",
        help="Do not enable auto proxy generation (default: proxies ON for 4K scrubbing)",
    )
    ap.add_argument(
        "--proxy-width",
        type=int,
        default=DEFAULT_PROXY_WIDTH,
        help=f"Proxy encode width (default {DEFAULT_PROXY_WIDTH})",
    )
    args = ap.parse_args()
    clone_blank(
        args.template,
        args.out,
        args.video,
        subtitle_srt=args.srt,
        enable_proxy=not args.no_proxy,
        proxy_width=args.proxy_width,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
