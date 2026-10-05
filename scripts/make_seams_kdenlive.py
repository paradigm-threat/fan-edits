#!/usr/bin/env python3
"""Per-seam Kdenlive projects for join QC.

Default (and the one to use once a FanMix has been rendered): --from-render.
Clips are slices of the finished MKV at output times, so Kdenlive is not
seeking the original HEVC. seams.json still records the original source
in/out of each removed span so subtitles can name the cut.

    python3 scripts/make_seams_kdenlive.py \
      --project "FanMixes/The Mummy (1999) - Debugged" \
      --from-render \
      --video "/media/ari/HD/FanEditRender/The Mummy (1999) - Debugged/The Mummy Debugged.mkv"

Without --from-render, projects point at the original rip (legacy).
Output names are generic (seam-01.kdenlive) so they are not mistaken for the feature.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from list_kdenlive_cuts import pick_kden, s_to_tc, tc_to_s  # noqa: E402
from render_seams import FD, PAD, video_clips, windows_from_clips  # noqa: E402

PROXY_RE = re.compile(r"/home/[^<\"]+/\.cache/kdenlive/proxy/[^<\"]+")


def kden_dur_colon(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ff = int(round((sec % 1.0) * 24))
    if ff >= 24:
        ff = 23
    return f"{h:02d}:{m:02d}:{s:02d}:{ff:02d}"


def entry_xml(producer: str, inn: str, out: str, extra: str = "") -> str:
    return (
        f'  <entry producer="{producer}" in="{inn}" out="{out}">\n'
        f'   <property name="kdenlive:id">4</property>\n'
        f"{extra}"
        f"  </entry>\n"
    )


def replace_playlist(xml: str, pid: str, body: str) -> str:
    pat = rf"( <playlist id=\"{pid}\">)[\s\S]*?( </playlist>)"
    if not re.search(pat, xml):
        raise SystemExit(f"missing playlist {pid}")
    return re.sub(pat, rf"\1\n{body} \2", xml, count=1)


def extra_filters_for(src_in: float, src_out: float, extras: list[tuple[float, float, str]]) -> str:
    for a, b, blob in extras:
        if abs(a - src_in) < 0.02 and abs(b - src_out) < 0.02:
            return blob
        if a <= src_in + 0.02 and b >= src_out - 0.02 and blob.strip():
            # trimmed inside a clip that has a whole-entry effect (e.g. hflip)
            if "in=" not in blob:
                return blob
    return ""


def collect_entry_extras(kden: Path, playlist_id: str) -> list[tuple[float, float, str]]:
    raw = kden.read_text(encoding="utf-8")
    m = re.search(rf'<playlist id="{playlist_id}">([\s\S]*?)</playlist>', raw)
    if not m:
        return []
    extras: list[tuple[float, float, str]] = []
    for em in re.finditer(
        r'<entry producer="[^"]+" in="([^"]+)" out="([^"]+)">([\s\S]*?)</entry>',
        m.group(1),
    ):
        inner = em.group(3)
        # keep filters only
        filters = "".join(re.findall(r"   <filter[\s\S]*?</filter>\n", inner))
        extras.append((tc_to_s(em.group(1)), tc_to_s(em.group(2)), filters))
    return extras


def retarget_original(xml: str, original: Path) -> str:
    xml = PROXY_RE.sub(original.as_posix(), xml)
    xml = xml.replace(
        '<property name="kdenlive:docproperties.enableproxy">1</property>',
        '<property name="kdenlive:docproperties.enableproxy">0</property>',
    )
    xml = xml.replace(
        '<property name="kdenlive:docproperties.generateproxy">1</property>',
        '<property name="kdenlive:docproperties.generateproxy">0</property>',
    )
    # drop burn-in so 4K scrubbing stays usable
    xml = re.sub(
        r"\n  <filter id=\"[^\"]+\">\n"
        r"   <property name=\"mlt_service\">avfilter\.subtitles</property>"
        r"[\s\S]*?</filter>",
        "",
        xml,
        count=1,
    )
    return xml


def new_uuids(xml: str) -> str:
    new = "{" + str(uuid.uuid4()) + "}"
    return re.sub(
        r"\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}",
        new,
        xml,
    )


def apply_timeline_length(xml: str, dur_s: float, playhead_s: float) -> str:
    out_tc = s_to_tc(max(FD, dur_s - FD))
    frames = max(1, int(round(dur_s * 24000 / 1001)))
    pos = max(0, int(round(playhead_s * 24000 / 1001)))
    repl = r'\g<1>' + out_tc + '"'
    xml = re.sub(
        r'(<tractor id="tractor1" in="00:00:00.000" out=")[^"]+"',
        repl,
        xml,
        count=1,
    )
    xml = re.sub(
        r'(<tractor id="tractor2" in="00:00:00.000" out=")[^"]+"',
        repl,
        xml,
        count=1,
    )
    xml = re.sub(
        r'(<tractor id="tractor4" in="00:00:00.000" out=")[^"]+"',
        repl,
        xml,
        count=1,
    )
    xml = re.sub(
        r'(<tractor id="tractor5" in="00:00:00.000" out=")[^"]+"',
        repl,
        xml,
        count=1,
    )
    xml = re.sub(
        r'(<track producer="tractor4" in="00:00:00.000" out=")[^"]+"',
        repl,
        xml,
        count=1,
    )
    xml = re.sub(
        r'(<entry producer="tractor4" in="00:00:00.000" out=")[^"]+"',
        repl,
        xml,
        count=1,
    )
    xml = re.sub(
        r'(<property name="kdenlive:duration">)[^<]+',
        rf"\g<1>{kden_dur_colon(dur_s)}",
        xml,
        count=1,
    )
    xml = re.sub(
        r'(<property name="kdenlive:maxduration">)\d+',
        rf"\g<1>{frames}",
        xml,
        count=1,
    )
    xml = re.sub(
        r'(<property name="kdenlive:sequenceproperties.position">)\d+',
        rf"\g<1>{pos}",
        xml,
        count=1,
    )
    xml = re.sub(
        r'(<property name="kdenlive:sequenceproperties.scrollPos">)\d+',
        r"\g<1>0",
        xml,
        count=1,
    )
    return xml


def pad_pair(left: dict, right: dict) -> tuple[tuple[float, float], tuple[float, float], float]:
    left_out = left["src_out"]
    right_in = right["src_in"]
    a0 = max(left["src_in"], left_out - PAD)
    a1 = left_out
    b0 = right_in
    b1 = min(right["src_out"], right_in + PAD)
    if a1 <= a0 + FD:
        a0 = left["src_in"]
    if b1 <= b0 + FD:
        b1 = right["src_out"]
    dur = (a1 - a0 + FD) + (b1 - b0 + FD)
    return (a0, a1), (b0, b1), dur


def pad_pair_render(left: dict, right: dict, film_end: float) -> tuple[tuple[float, float], tuple[float, float], float]:
    """5s on each side of the join, in finished-render output time."""
    join = left["out_out"]
    a0 = max(0.0, join - PAD)
    a1 = max(a0, join - FD)
    b0 = join
    b1 = min(film_end, right["out_out"], join + PAD)
    if b1 <= b0 + FD:
        b1 = min(film_end, b0 + PAD)
    dur = (a1 - a0 + FD) + (b1 - b0 + FD)
    return (a0, a1), (b0, b1), dur


TEMPLATE = (
    ROOT
    / "FanMixes"
    / "The Mummy (1999) - Debugged"
    / "The Mummy Debugged.kdenlive"
)


def probe_duration(path: Path) -> float:
    r = subprocess_duration(path)
    return r


def subprocess_duration(path: Path) -> float:
    import subprocess

    proc = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        capture_output=True, text=True,
    )
    err = (proc.stderr or "") + (proc.stdout or "")
    if "ended prematurely" in err.lower():
        raise SystemExit(f"truncated video: {path}")
    raw = (proc.stdout or "").strip()
    if raw and raw != "N/A":
        return float(raw)
    proc = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "packet=pts_time", "-of", "csv=p=0",
            "-read_intervals", "999999", str(path),
        ],
        capture_output=True, text=True,
    )
    err = proc.stderr or ""
    if "ended prematurely" in err.lower():
        raise SystemExit(f"truncated video: {path}")
    lines = [ln.strip() for ln in (proc.stdout or "").splitlines() if ln.strip() and ln.strip() != "N/A"]
    if not lines:
        raise SystemExit(f"no duration: {path}")
    return float(lines[-1])


def retarget_render(xml: str, render: Path, dur_s: float) -> str:
    """Point the Mummy blank's film chains at a finished FanMix. Proxies off."""
    path = render.as_posix()
    xml = PROXY_RE.sub(path, xml)
    xml = xml.replace(
        '<property name="kdenlive:docproperties.enableproxy">1</property>',
        '<property name="kdenlive:docproperties.enableproxy">0</property>',
    )
    xml = xml.replace(
        '<property name="kdenlive:docproperties.generateproxy">1</property>',
        '<property name="kdenlive:docproperties.generateproxy">0</property>',
    )
    xml = re.sub(
        r"\n  <filter id=\"[^\"]+\">\n"
        r"   <property name=\"mlt_service\">avfilter\.subtitles</property>"
        r"[\s\S]*?</filter>",
        "",
        xml,
        count=1,
    )
    for prop in ("kdenlive:originalurl", "kdenlive:original.resource"):
        xml = re.sub(
            rf'(<property name="{prop}">)[^<]*',
            rf"\g<1>{path}",
            xml,
        )
    xml = re.sub(r'\n   <property name="kdenlive:proxy">[^<]*</property>', "", xml)
    xml = re.sub(r'\n   <property name="kdenlive:file_hash">[^<]*</property>', "", xml)
    # Template dissolves belong to the Mummy feature timeline. A seam project
    # is only the padded join, so those transitions would land on the wrong frames.
    xml = re.sub(r"\n  <transition id=\"[^\"]+\">[\s\S]*?</transition>", "", xml)
    frames = max(1, int(round(dur_s * 24000 / 1001)))
    out_tc = s_to_tc(max(FD, dur_s - FD))

    def repl_chain(m: re.Match[str]) -> str:
        block = m.group(0)
        block = re.sub(r'\bout="[^"]+"', f'out="{out_tc}"', block, count=1)
        block = re.sub(
            r'(<property name="length">)\d+',
            rf"\g<1>{frames}",
            block,
            count=1,
        )
        block = re.sub(
            r'(<property name="kdenlive:original.out">)\d+',
            rf"\g<1>{frames - 1}",
            block,
            count=1,
        )
        block = re.sub(
            r'(<property name="kdenlive:original.length">)\d+',
            rf"\g<1>{frames}",
            block,
            count=1,
        )
        block = re.sub(
            r'(<property name="kdenlive:file_size">)\d+',
            rf"\g<1>{render.stat().st_size}",
            block,
            count=1,
        )
        return block

    xml = re.sub(r"<chain id=\"chain\d+\"[\s\S]*?</chain>", repl_chain, xml)
    return xml


def pair_playlists(
    left: tuple[float, float],
    right: tuple[float, float],
    extras: list[tuple[float, float, str]],
) -> tuple[str, str, str, str, str]:
    l_in, l_out = s_to_tc(left[0]), s_to_tc(left[1])
    r_in, r_out = s_to_tc(right[0]), s_to_tc(right[1])
    lf = extra_filters_for(left[0], left[1], extras)
    rf = extra_filters_for(right[0], right[1], extras)
    v = entry_xml("chain2", l_in, l_out, lf) + entry_xml("chain2", r_in, r_out, rf)
    a = (
        '  <property name="kdenlive:audio_track">1</property>\n'
        + entry_xml("chain0", l_in, l_out)
        + entry_xml("chain0", r_in, r_out)
    )
    a2 = '  <property name="kdenlive:audio_track">1</property>\n'
    extra0 = '  <property name="kdenlive:audio_track">1</property>\n'
    extra1 = '  <property name="kdenlive:audio_track">1</property>\n'
    return v, a, a2, extra0, extra1


def write_project(
    template: str,
    dest: Path,
    playlist_bodies: dict[str, str],
    dur_s: float,
    playhead_s: float,
    original: Path,
    root_dir: Path,
) -> None:
    xml = retarget_original(template, original)
    xml = re.sub(r'(<mlt [^>]*\broot=")[^"]+"', rf'\g<1>{root_dir.as_posix()}"', xml, count=1)
    for pid, body in playlist_bodies.items():
        xml = replace_playlist(xml, pid, body)
    xml = apply_timeline_length(xml, dur_s, playhead_s)
    xml = new_uuids(xml)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(xml, encoding="utf-8")


def seam_record(i: int, sm: dict, left: tuple[float, float], right: tuple[float, float], name: str, video: Path, from_render: bool) -> dict:
    rec = {
        "file": name,
        "join": i,
        "out_join": s_to_tc(sm["out_join"]),
        "removed_s": round(sm["gap"], 3),
        "source_removed": {
            "in": s_to_tc(sm["left"]["src_out"]),
            "out": s_to_tc(sm["right"]["src_in"]),
        },
        "left": {"in": s_to_tc(left[0]), "out": s_to_tc(left[1])},
        "right": {"in": s_to_tc(right[0]), "out": s_to_tc(right[1])},
    }
    if from_render:
        rec["render"] = str(video)
    else:
        rec["original"] = str(video)
    return rec


def main() -> int:
    ap = argparse.ArgumentParser(description="Write generic per-seam .kdenlive projects")
    ap.add_argument("--project", type=Path, required=True)
    ap.add_argument("--kdenlive", type=Path)
    ap.add_argument("--video", type=Path, help="Finished render (--from-render) or original rip")
    ap.add_argument(
        "--from-render",
        action="store_true",
        help="--video is the finished FanMix; timeline in/out are output times",
    )
    ap.add_argument("--out-dir", type=Path, help="Defaults to <project>/seams")
    args = ap.parse_args()

    proj = args.project.resolve()
    kden = args.kdenlive or pick_kden(proj)
    if not kden:
        raise SystemExit(f"no kdenlive in {proj}")
    clips, video = video_clips(kden)
    if args.video:
        video = args.video
    if video is None or not video.exists():
        raise SystemExit(f"missing video: {video}")
    seams, _windows = windows_from_clips(clips, None)
    if not seams:
        raise SystemExit(f"no seams in {proj.name}")
    film_end = probe_duration(video) if args.from_render else clips[-1]["src_out"]
    extras = [] if args.from_render else collect_entry_extras(kden, "playlist4")
    if args.from_render:
        if not TEMPLATE.exists():
            raise SystemExit(f"missing template: {TEMPLATE}")
        template = retarget_render(TEMPLATE.read_text(encoding="utf-8"), video, film_end)
    else:
        template = kden.read_text(encoding="utf-8")
    out_dir = (args.out_dir or (proj / "seams")).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("seam-*.kdenlive"):
        old.unlink()

    def bounds(sm: dict) -> tuple[tuple[float, float], tuple[float, float], float]:
        if args.from_render:
            return pad_pair_render(sm["left"], sm["right"], film_end)
        return pad_pair(sm["left"], sm["right"])

    manifest: list[dict] = []
    fade_blank = '  <blank length="00:00:00.500"/>\n'

    for i, sm in enumerate(seams, 1):
        left, right, dur = bounds(sm)
        v, a, a2, extra0, extra1 = pair_playlists(left, right, extras)
        dest = out_dir / f"seam-{i:02d}.kdenlive"
        write_project(
            template,
            dest,
            {
                "playlist4": v,
                "playlist2": a,
                "playlist3": a2,
                "playlist0": extra0,
                "playlist1": extra1,
            },
            dur,
            (left[1] - left[0] + FD),
            video,
            proj,
        )
        rec = seam_record(i, sm, left, right, dest.name, video, args.from_render)
        manifest.append(rec)
        print(
            f"  {dest.name}  out {rec['out_join']}  "
            f"render {rec['left']['out']} → {rec['right']['in']}  "
            f"source {rec['source_removed']['in']} → {rec['source_removed']['out']}  "
            f"removed {sm['gap']:.1f}s"
        )

    all_a_parts = ['  <property name="kdenlive:audio_track">1</property>\n']
    all_v_parts: list[str] = []
    all_dur = 0.0
    for i, sm in enumerate(seams, 1):
        left, right, dur = bounds(sm)
        v, _a, _a2, _e0, _e1 = pair_playlists(left, right, extras)
        if i > 1:
            all_v_parts.append(fade_blank)
            all_a_parts.append(fade_blank)
            all_dur += 0.5
        all_v_parts.append(v)
        all_a_parts.append(entry_xml("chain0", s_to_tc(left[0]), s_to_tc(left[1])))
        all_a_parts.append(entry_xml("chain0", s_to_tc(right[0]), s_to_tc(right[1])))
        all_dur += dur

    write_project(
        template,
        out_dir / "seams.kdenlive",
        {
            "playlist4": "".join(all_v_parts),
            "playlist2": "".join(all_a_parts),
            "playlist3": '  <property name="kdenlive:audio_track">1</property>\n',
            "playlist0": '  <property name="kdenlive:audio_track">1</property>\n',
            "playlist1": '  <property name="kdenlive:audio_track">1</property>\n',
        },
        all_dur,
        (bounds(seams[0])[2] / 2.0) if seams else 0.0,
        video,
        proj,
    )
    note = (
        "QC joins on the finished render (output times). "
        "source_removed is the original-rip span so subtitles can name the cut. Not the feature."
        if args.from_render
        else "QC join projects on the original rip. Not the feature."
    )
    (out_dir / "seams.json").write_text(
        json.dumps(
            {
                "note": note,
                "project": proj.name,
                "source_kdenlive": kden.name,
                "from_render": bool(args.from_render),
                "render": str(video) if args.from_render else None,
                "original": None if args.from_render else str(video),
                "proxy": False,
                "seams": manifest,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(manifest)} seam projects + seams.kdenlive in {out_dir}")
    print(f"{'render' if args.from_render else 'original'}={video}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
