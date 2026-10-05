#!/usr/bin/env python3
"""QC seams reel for a FanMix: padded joins + fadeblack between clips.

Always writes seams.mkv — never a title that looks like the movie.

Optional --credits-start includes the rest of the output timeline (use when
a replacement credits song starts). Extra MP3/WAV beds need --melt-mlt
unless --from-render (the finished FanMix already has those beds).

--from-render reads the finished MKV at output times so joins are not
re-cut from the original rip (avoids HEVC seek flashes).
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from list_kdenlive_cuts import (  # noqa: E402
    pick_kden,
    primary_film_ids,
    tc_to_s,
    video_playlist_ids,
)

FD = 1001 / 24000.0
MIN_GAP = 0.80
PAD = 5.0
FADE = 0.50
SCALE = "1920:1080"
PIX = "yuv420p"


def s_to_tc(t: float) -> str:
    t = max(0.0, t)
    ms = int(round(t * 1000.0))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, msec = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{msec:03d}"


def parse_tc_arg(s: str) -> float:
    parts = s.strip().replace(",", ".").split(":")
    if len(parts) == 1:
        return float(parts[0])
    if len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd[:10]), ("..." if len(cmd) > 10 else ""), file=sys.stderr)
    subprocess.run(cmd, check=True)


SEARCH_ROOTS = [
    Path("/home/ari/Videos"),
    Path("/media/ari/HD/FanEditRender"),
    Path("/home/ari/Videos/FanEdits"),
]

VIDEO_EXTS = {".mkv", ".mp4", ".m4v", ".mov", ".avi"}
_RIP_INDEX: dict[str, Path] | None = None


def _index_rips() -> dict[str, Path]:
    global _RIP_INDEX
    if _RIP_INDEX is not None:
        return _RIP_INDEX
    index: dict[str, Path] = {}

    def consider(p: Path) -> None:
        if not p.is_file() or p.suffix.lower() not in VIDEO_EXTS:
            return
        try:
            if p.stat().st_size <= 8_000_000:
                return
        except OSError:
            return
        # First hit wins; later duplicates ignored. Local roots are ordered.
        index.setdefault(p.name, p)

    def walk(root: Path, depth: int) -> None:
        if depth < 0 or not root.is_dir():
            return
        try:
            kids = list(root.iterdir())
        except OSError:
            return
        for p in kids:
            if p.name.startswith(".") or p.name in {"$RECYCLE.BIN", "proxy"}:
                continue
            if p.is_file():
                consider(p)
            elif p.is_dir():
                walk(p, depth - 1)

    for root in SEARCH_ROOTS:
        if root.exists():
            walk(root, 4)
    _RIP_INDEX = index
    return index


def _candidate_names(raw: str) -> list[str]:
    name = Path(raw.replace("\\", "/")).name
    if not name or name in {"black", "0x00000000"}:
        return []
    out = [name]
    # Windows / relative leftovers
    if " " in name:
        out.append(name.replace(" ", "."))
    return out


def find_rip_by_name(name: str) -> Path | None:
    if not name:
        return None
    return _index_rips().get(name)


def _looks_like_short(raw: str) -> bool:
    n = raw.lower()
    return any(x in n for x in ("next.day", "next day", "trailer", "-720p"))


def film_resource(root: ET.Element, producers: set[str]) -> Path | None:
    scored: list[tuple[int, str]] = []
    for chain in list(root.iter("chain")) + list(root.iter("producer")):
        if producers and chain.get("id") not in producers:
            continue
        original = resource = ""
        length_s = 0.0
        for prop in chain.findall("property"):
            name = prop.get("name") or ""
            if name in ("kdenlive:original.resource", "kdenlive:originalurl"):
                original = (prop.text or "").strip()
            if name == "resource":
                resource = (prop.text or "").strip()
            if name == "length" and prop.text:
                try:
                    length_s = float(prop.text) * FD
                except ValueError:
                    pass
        for cand in (original, resource):
            if not cand or cand.endswith("black") or "kdenlive/proxy" in cand:
                continue
            if _looks_like_short(cand):
                continue
            score = 2 if length_s > 3600 else 0
            if any(x in cand.lower() for x in ("2160p", "1080p", "bluray", "yts", "remux", "remastered")):
                score += 2
            scored.append((score, cand))
    scored.sort(key=lambda x: -x[0])
    for _, cand in scored:
        p = Path(cand)
        if p.exists():
            return p
    for _, cand in scored:
        for name in _candidate_names(cand):
            found = find_rip_by_name(name)
            if found:
                return found
    return None


def video_clips(kden: Path) -> tuple[list[dict], Path]:
    root = ET.parse(kden).getroot()
    producers = primary_film_ids(root, kden.parent.name)
    video_pls = video_playlist_ids(root)
    preferred = [pid for pid in ("playlist4", "playlist2") if pid in video_pls] or sorted(video_pls)

    def has_film(cand: ET.Element) -> bool:
        return any(
            (not producers or e.get("producer") in producers)
            and e.get("in")
            and e.get("out")
            for e in cand.findall("entry")
        )

    def film_dur(cand: ET.Element) -> float:
        total = 0.0
        for e in cand.findall("entry"):
            if producers and e.get("producer") not in producers:
                continue
            raw_in, raw_out = e.get("in"), e.get("out")
            if raw_in is None or raw_out is None:
                continue
            try:
                a, b = tc_to_s(raw_in), tc_to_s(raw_out)
            except ValueError:
                continue
            if b > a:
                total += b - a + FD
        return total

    # Prefer the timeline with the most feature footage (Silent Hill keeps
    # OST beds on other V tracks). Fall back to A1/A2 for sparse edits.
    ranked: list[tuple[float, ET.Element]] = []
    seen: set[str] = set()
    for pid in list(preferred) + sorted(video_pls):
        cand = root.find(f".//playlist[@id='{pid}']")
        if cand is None or pid in seen:
            continue
        seen.add(pid)
        d = film_dur(cand)
        if d > 0:
            ranked.append((d, cand))
    if not ranked:
        for cand in root.iter("playlist"):
            pid = cand.get("id") or ""
            if pid in ("main_bin",) or pid in seen:
                continue
            d = film_dur(cand)
            if d > 0:
                ranked.append((d, cand))
    if not ranked:
        raise SystemExit(f"no film playlist in {kden}")
    ranked.sort(key=lambda x: -x[0])
    pl = ranked[0][1]
    clips: list[dict] = []
    out_t = 0.0
    for ent in pl.findall("entry"):
        if producers and ent.get("producer") not in producers:
            continue
        raw_in, raw_out = ent.get("in"), ent.get("out")
        if raw_in is None or raw_out is None:
            continue
        a, b = tc_to_s(raw_in), tc_to_s(raw_out)
        if b <= a:
            continue
        dur = b - a + FD
        clips.append(
            {"src_in": a, "src_out": b, "out_in": out_t, "out_out": out_t + dur, "dur": dur}
        )
        out_t += dur
    # Scene-detected playlists (Serenity) split contiguous film into thousands
    # of entries. Merge those so a 10s window is one ffmpeg input, not 200.
    merged: list[dict] = []
    for c in clips:
        if merged and c["src_in"] - merged[-1]["src_out"] < MIN_GAP:
            merged[-1]["src_out"] = c["src_out"]
            merged[-1]["out_out"] = c["out_out"]
            merged[-1]["dur"] = merged[-1]["out_out"] - merged[-1]["out_in"]
        else:
            merged.append(dict(c))
    clips = merged
    video = film_resource(root, producers)
    if not clips:
        raise SystemExit(f"no film entries on {pl.get('id')}")
    return clips, video


def windows_from_clips(
    clips: list[dict], credits_start: float | None
) -> tuple[list[dict], list[tuple[float, float]]]:
    cap = credits_start if credits_start is not None else clips[-1]["out_out"]
    seams: list[dict] = []
    for i in range(len(clips) - 1):
        left, right = clips[i], clips[i + 1]
        gap = right["src_in"] - left["src_out"]
        if gap < MIN_GAP:
            continue
        if left["out_out"] >= cap:
            continue
        seams.append({"out_join": left["out_out"], "gap": gap, "left": left, "right": right})
    windows: list[list[float]] = []
    for sm in seams:
        lo = max(0.0, sm["out_join"] - PAD)
        hi = min(cap, sm["out_join"] + PAD)
        if hi <= lo + 0.2:
            continue
        if not windows or lo > windows[-1][1] + 2.5:
            windows.append([lo, hi])
        else:
            windows[-1][1] = max(windows[-1][1], hi)
    return seams, [(a, b) for a, b in windows]


def slices_for_window(clips: list[dict], lo: float, hi: float) -> list[tuple[float, float]]:
    pieces: list[tuple[float, float]] = []
    for c in clips:
        a = max(c["out_in"], lo)
        b = min(c["out_out"], hi)
        if b - a < FD:
            continue
        src = c["src_in"] + (a - c["out_in"])
        pieces.append((src, b - a))
    return pieces


def encode_window(video: Path, pieces: list[tuple[float, float]], dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    common = [
        "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", PIX,
        "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000",
    ]
    # Hybrid seek: input-seek a couple of seconds early, then output-trim so
    # HEVC lands on the requested frame. Plain `-ss` before `-i` plus `fps=`
    # was flashing one frame of the removed shot at every join.
    preroll = 2.0
    cmd: list[str] = ["ffmpeg", "-hide_banner", "-y"]
    fc: list[str] = []
    for i, (src, dur) in enumerate(pieces):
        pre = min(preroll, src)
        cmd += ["-ss", f"{src - pre:.6f}", "-i", str(video)]
        fc.append(
            f"[{i}:v]trim=start={pre:.6f}:duration={dur:.6f},setpts=PTS-STARTPTS,scale={SCALE}[v{i}];"
            f"[{i}:a]atrim=start={pre:.6f}:duration={dur:.6f},asetpts=PTS-STARTPTS,"
            f"aformat=sample_rates=48000:channel_layouts=stereo[a{i}]"
        )
    n = len(pieces)
    fc.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[outv][outa]")
    cmd += ["-filter_complex", ";".join(fc), "-map", "[outv]", "-map", "[outa]", *common, str(dest)]
    run(cmd)
    if not dest.exists() or dest.stat().st_size < 10_000:
        raise SystemExit(f"empty window encode: {dest}")


def encode_credits_melt(mlt: Path, start: float, end: float, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "melt", "-profile", "atsc_1080p_2398", "-progress", str(mlt),
            f"in={s_to_tc(start)}", f"out={s_to_tc(end)}",
            "-consumer", f"avformat:{dest}",
            "vcodec=libx264", "crf=18", "preset=veryfast",
            "acodec=aac", "ab=160k", "f=mp4", "real_time=-1",
        ]
    )


def xfade_concat(clips: list[Path], dest: Path) -> None:
    if not clips:
        raise SystemExit("no clips")
    dest.parent.mkdir(parents=True, exist_ok=True)
    if len(clips) == 1:
        run(["ffmpeg", "-hide_banner", "-y", "-i", str(clips[0]), "-c", "copy", str(dest)])
        return
    durs = []
    for p in clips:
        r = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(p),
            ],
            check=True, capture_output=True, text=True,
        )
        raw = r.stdout.strip()
        if not raw or raw == "N/A":
            raise SystemExit(f"window has no duration: {p} ({p.stat().st_size} bytes)")
        durs.append(float(raw))
    cmd: list[str] = ["ffmpeg", "-hide_banner", "-y"]
    for p in clips:
        cmd += ["-i", str(p)]
    vcur, acur = "[0:v]", "[0:a]"
    acc = durs[0]
    fc: list[str] = []
    for i in range(1, len(clips)):
        off = max(0.05, acc - FADE)
        vout, aout = f"[xv{i}]", f"[xa{i}]"
        fc.append(
            f"{vcur}[{i}:v]xfade=transition=fadeblack:duration={FADE}:offset={off:.3f}{vout};"
            f"{acur}[{i}:a]acrossfade=d={FADE}{aout}"
        )
        vcur, acur = vout, aout
        acc = acc + durs[i] - FADE
    cmd += [
        "-filter_complex", ";".join(fc),
        "-map", vcur, "-map", acur,
        "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", PIX,
        "-c:a", "aac", "-b:a", "160k",
        str(dest),
    ]
    run(cmd)


def main() -> int:
    ap = argparse.ArgumentParser(description="Render a generic seams.mkv QC reel")
    ap.add_argument("--project", type=Path, required=True, help="FanMix folder")
    ap.add_argument("--video", type=Path, help="Override source rip or finished render")
    ap.add_argument("--kdenlive", type=Path)
    ap.add_argument(
        "--from-render",
        action="store_true",
        help="--video is the finished FanMix; extract output-timeline windows only",
    )
    ap.add_argument("--credits-start", help="Output timecode to append the rest (new credits song)")
    ap.add_argument("--melt-mlt", type=Path, help="MLT with extra audio for the credits tail")
    ap.add_argument("--work", type=Path, help="Scratch folder for window clips")
    ap.add_argument("--out", type=Path, help="Defaults to <scratch>/seams.mkv")
    args = ap.parse_args()

    proj = args.project.resolve()
    kden = args.kdenlive or pick_kden(proj)
    if not kden:
        raise SystemExit(f"no kdenlive in {proj}")
    clips, video = video_clips(kden)
    if args.video:
        video = args.video
    if video is None:
        raise SystemExit("could not resolve original rip path")
    if not video.exists():
        raise SystemExit(f"missing video: {video}")
    credits_start = parse_tc_arg(args.credits_start) if args.credits_start else None
    seams, windows = windows_from_clips(clips, credits_start)
    end_s = clips[-1]["out_out"]
    print(
        f"{proj.name}: clips={len(clips)} seams={len(seams)} "
        f"windows={len(windows)} end={s_to_tc(end_s)} "
        f"{'from-render' if args.from_render else 'from-rip'} src={video}"
    )
    for i, sm in enumerate(seams, 1):
        print(
            f"  join {i:02d}  out {s_to_tc(sm['out_join'])}  "
            f"removed {sm['gap']:.1f}s"
        )

    scratch = args.work or Path("/media/ari/HD/FanEditRender") / proj.name / "seams-work"
    scratch.mkdir(parents=True, exist_ok=True)
    out = args.out or (scratch.parent / "seams.mkv")

    pieces: list[Path] = []
    for i, (lo, hi) in enumerate(windows, 1):
        dest = scratch / f"win_{i:02d}.mp4"
        if args.from_render:
            sl = [(lo, hi - lo)]
        else:
            sl = slices_for_window(clips, lo, hi)
        print(f"window {i:02d} out {s_to_tc(lo)}-{s_to_tc(hi)} slices={len(sl)}")
        encode_window(video, sl, dest)
        pieces.append(dest)
    if credits_start is not None and end_s > credits_start + 1:
        cred = scratch / "credits.mp4"
        print(f"credits out {s_to_tc(credits_start)}-{s_to_tc(end_s)}")
        if args.from_render:
            encode_window(video, [(credits_start, end_s - credits_start)], cred)
        elif args.melt_mlt:
            encode_credits_melt(args.melt_mlt, credits_start, end_s, cred)
        else:
            encode_window(video, slices_for_window(clips, credits_start, end_s), cred)
        pieces.append(cred)
    if not pieces:
        raise SystemExit("no seams and no credits — nothing to render")
    xfade_concat(pieces, out)
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
