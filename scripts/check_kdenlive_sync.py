#!/usr/bin/env python3
"""Automatic Kdenlive sync / 1-frame checks for a FanMix.

Catches the problems that already bit Mummy 1/2:

- Proxy frame count ≠ original (usually `-vsync 1` / `-fps_mode cfr`)
- Leftover ±1 frame `in`/`out` shift after the proxy was regenerated
- Film audio source time drifted off the video master
- Silent holes under picture (A1/A2 gap)

    python3 scripts/check_kdenlive_sync.py \
      --project "FanMixes/The Mummy (1999) - Debugged"

    python3 scripts/check_kdenlive_sync.py --all
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
    s_to_tc,
    tc_to_s,
    video_playlist_ids,
)
from render_seams import film_resource  # noqa: E402

FD = 1001 / 24000.0
SHIFT_LO, SHIFT_HI = 0.5 * FD, 1.6 * FD
AV_TOL = 4.0 * FD  # mix-handle / ms rounding; >4 frames is real drift
HOLE_MIN = 0.35
SAMPLE_STEP = 2.0


def probe_frames(path: Path) -> int | None:
    if not path.exists():
        return None
    r = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-count_packets", "-show_entries", "stream=nb_read_packets,nb_frames",
            "-of", "csv=p=0", str(path),
        ],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        return None
    best = 0
    for part in r.stdout.replace("\n", ",").split(","):
        part = part.strip()
        if part.isdigit():
            best = max(best, int(part))
    return best or None


def docprop(root: ET.Element, name: str) -> str:
    for prop in root.iter("property"):
        if prop.get("name") == f"kdenlive:docproperties.{name}":
            return (prop.text or "").strip()
    return ""


def chain_media(root: ET.Element, producers: set[str]) -> dict:
    info = {
        "resource": "",
        "original": "",
        "proxy": "",
        "length": 0,
        "original_length": 0,
    }
    for chain in list(root.iter("chain")) + list(root.iter("producer")):
        if chain.get("id") not in producers:
            continue
        for prop in chain.findall("property"):
            name = prop.get("name") or ""
            text = (prop.text or "").strip()
            if name == "resource" and text and "black" not in text:
                info["resource"] = text
            if name in ("kdenlive:original.resource", "kdenlive:originalurl") and text:
                info["original"] = text
            if name == "kdenlive:proxy" and text:
                info["proxy"] = text
            if name == "length" and text.isdigit():
                info["length"] = max(info["length"], int(text))
            if name == "kdenlive:original.length" and text.isdigit():
                info["original_length"] = max(info["original_length"], int(text))
        if info["original"] or info["resource"]:
            break
    return info


def playlist_segments(pl: ET.Element, film_ids: set[str]) -> list[dict]:
    segs: list[dict] = []
    out_t = 0.0
    for child in list(pl):
        if child.tag == "blank":
            raw = child.get("length") or "0"
            try:
                out_t += tc_to_s(raw)
            except ValueError:
                pass
            continue
        if child.tag != "entry":
            continue
        raw_in, raw_out = child.get("in"), child.get("out")
        if raw_in is None or raw_out is None:
            continue
        try:
            a, b = tc_to_s(raw_in), tc_to_s(raw_out)
        except ValueError:
            continue
        if b <= a:
            continue
        dur = b - a + FD
        prod = child.get("producer") or ""
        segs.append(
            {
                "src_in": a,
                "src_out": b,
                "out_in": out_t,
                "out_out": out_t + dur,
                "film": prod in film_ids,
                "producer": prod,
            }
        )
        out_t += dur
    return segs


def covering(segs: list[dict], t: float) -> list[dict]:
    return [s for s in segs if s["out_in"] - 1e-4 <= t < s["out_out"] - 1e-4]


def src_at(seg: dict, t: float) -> float:
    return seg["src_in"] + (t - seg["out_in"])


def pick_video_playlist(root: ET.Element) -> ET.Element | None:
    ids = video_playlist_ids(root)
    for pid in ("playlist4", "playlist2"):
        if pid in ids:
            pl = root.find(f".//playlist[@id='{pid}']")
            if pl is not None and pl.findall("entry"):
                return pl
    for pid in sorted(ids):
        pl = root.find(f".//playlist[@id='{pid}']")
        if pl is not None and pl.findall("entry"):
            return pl
    return None


def audio_playlists(root: ET.Element) -> list[ET.Element]:
    out: list[ET.Element] = []
    for pl in root.iter("playlist"):
        pid = pl.get("id") or ""
        if pid == "main_bin" or not pid.startswith("playlist"):
            continue
        if pl.find("property[@name='kdenlive:audio_track']") is not None:
            out.append(pl)
    return out


def issue(level: str, code: str, msg: str) -> dict:
    return {"level": level, "code": code, "msg": msg}


def check_project(proj: Path, *, probe: bool = True) -> dict:
    kden = pick_kden(proj)
    rec: dict = {"folder": proj.name, "kdenlive": kden.name if kden else None, "issues": []}
    issues: list[dict] = rec["issues"]
    if not kden:
        issues.append(issue("warn", "no_kden", "no .kdenlive (skip)"))
        return rec
    root = ET.parse(kden).getroot()
    producers = primary_film_ids(root, proj.name)
    media = chain_media(root, producers)
    rec["resource"] = media["resource"]
    rec["original"] = media["original"]
    rec["proxy"] = media["proxy"]

    params = docprop(root, "proxyparams").lower()
    if "-vsync 1" in params or "fps_mode cfr" in params or "-vsync cfr" in params:
        issues.append(
            issue(
                "error",
                "proxyparams",
                "proxyparams uses -vsync 1 / fps_mode cfr — that pads +1 frame. "
                "Use -fps_mode passthrough, delete the proxy, reopen.",
            )
        )

    original = Path(media["original"]) if media["original"] else None
    if original is None or not original.exists():
        resolved = film_resource(root, producers)
        original = resolved
    proxy = Path(media["proxy"]) if media["proxy"] else None
    if proxy and "kdenlive/proxy" not in str(proxy):
        # retargeted seam project — treat as no proxy
        proxy = None

    orig_n = proxy_n = None
    if probe:
        if original and original.exists():
            orig_n = probe_frames(original)
        if proxy and proxy.exists():
            proxy_n = probe_frames(proxy)
    rec["original_frames"] = orig_n
    rec["proxy_frames"] = proxy_n

    if orig_n and proxy_n and orig_n != proxy_n:
        issues.append(
            issue(
                "error",
                "proxy_frames",
                f"proxy has {proxy_n} frames, original has {orig_n} "
                f"({proxy_n - orig_n:+d}). Razors on the proxy will be off on the 4K. "
                "Delete the proxy and regenerate with passthrough.",
            )
        )
    if orig_n and media["length"] and abs(media["length"] - orig_n) >= 1:
        issues.append(
            issue(
                "warn",
                "stored_length",
                f"chain length={media['length']} vs original frames={orig_n}. "
                "Stale metadata after a proxy rebuild.",
            )
        )

    vpl = pick_video_playlist(root)
    if vpl is None:
        issues.append(issue("error", "no_video", "no video playlist with film entries"))
        return rec
    vsegs = playlist_segments(vpl, producers)
    film_v = [s for s in vsegs if s["film"]]
    if not film_v:
        issues.append(issue("error", "no_film_video", "video playlist has no film clips"))
        return rec

    first_in = film_v[0]["src_in"]
    rec["first_in"] = s_to_tc(first_in)
    leftover = SHIFT_LO <= first_in <= SHIFT_HI
    if leftover:
        if orig_n and proxy_n and orig_n == proxy_n:
            issues.append(
                issue(
                    "error",
                    "leftover_shift",
                    f"first film in={s_to_tc(first_in)} (~1 frame) but proxy and "
                    "original frame counts match. The compensating shift is stale — "
                    "every original-based render flashes one frame of the cut. "
                    "Dry-run: scripts/shift_kdenlive_frames.py --frames -1",
                )
            )
        elif orig_n and proxy_n and proxy_n == orig_n + 1:
            issues.append(
                issue(
                    "warn",
                    "shift_compensating",
                    f"first film in={s_to_tc(first_in)} (~1 frame). Proxy is still "
                    "+1 vs original, so the shift may be compensating. Regenerate "
                    "the proxy, then unshift only after a join is QC'd on the 4K.",
                )
            )
        else:
            issues.append(
                issue(
                    "warn",
                    "first_in_offset",
                    f"first film in={s_to_tc(first_in)} (~1 frame). Confirm this is "
                    "intentional; leftover shifts after a proxy rebuild cause 1-frame flashes.",
                )
            )

    audio_segs: list[dict] = []
    for apl in audio_playlists(root):
        audio_segs.extend(playlist_segments(apl, producers))

    holes: list[tuple[float, float]] = []
    drifts: list[tuple[float, float, float]] = []
    hole_start: float | None = None
    drift_start: float | None = None
    drift_delta = 0.0
    last_t = film_v[0]["out_in"]

    def samples(seg: dict) -> list[float]:
        a = seg["out_in"] + 0.08
        b = seg["out_out"] - 0.08
        if b <= a:
            return [(seg["out_in"] + seg["out_out"]) / 2]
        t = a
        out = []
        while t <= b:
            out.append(t)
            t += SAMPLE_STEP
        out.append(b)
        return out

    for v in film_v:
        for t in samples(v):
            vsrc = src_at(v, t)
            here = covering(audio_segs, t)
            film_a = [s for s in here if s["film"]]
            extra_a = [s for s in here if not s["film"]]
            if not here:
                if hole_start is None:
                    hole_start = t
                last_t = t
                if drift_start is not None:
                    drifts.append((drift_start, last_t, drift_delta))
                    drift_start = None
                continue
            if hole_start is not None:
                holes.append((hole_start, t))
                hole_start = None
            if film_a:
                deltas = [src_at(s, t) - vsrc for s in film_a]
                ok = any(abs(d) <= AV_TOL for d in deltas)
                if not ok:
                    if drift_start is None:
                        drift_start = t
                        drift_delta = min(deltas, key=abs)
                    last_t = t
                    continue
            elif extra_a:
                # replacement bed only — not a drift, not a hole
                pass
            if drift_start is not None:
                drifts.append((drift_start, t, drift_delta))
                drift_start = None
    if hole_start is not None:
        holes.append((hole_start, film_v[-1]["out_out"]))
    if drift_start is not None:
        drifts.append((drift_start, last_t, drift_delta))

    rec["audio_holes"] = [{"out": s_to_tc(a), "to": s_to_tc(b), "dur": round(b - a, 3)} for a, b in holes if b - a >= HOLE_MIN]
    rec["av_drifts"] = [
        {"out": s_to_tc(a), "to": s_to_tc(b), "dur": round(b - a, 3), "audio_minus_video": round(d, 3)}
        for a, b, d in drifts
        if b - a >= HOLE_MIN
    ]
    for h in rec["audio_holes"]:
        issues.append(
            issue(
                "warn" if h["dur"] > 30 else "error",
                "audio_hole",
                f"no audio under picture {h['out']}–{h['to']} ({h['dur']:.1f}s). "
                "Long holes are often intentional credits; short ones are missing film audio.",
            )
        )
    for d in rec["av_drifts"][:12]:
        issues.append(
            issue(
                "error",
                "av_drift",
                f"film audio source ≠ video source {d['out']}–{d['to']} ({d['dur']:.1f}s, "
                f"audio {d['audio_minus_video']:+.3f}s). Relock audio in/out to the video master; "
                "do not invent A2 mix XML.",
            )
        )
    if len(rec["av_drifts"]) > 12:
        issues.append(
            issue("error", "av_drift", f"… +{len(rec['av_drifts']) - 12} more A/V drift windows")
        )
    return rec


def print_rec(rec: dict) -> None:
    errs = sum(1 for i in rec["issues"] if i["level"] == "error")
    warns = sum(1 for i in rec["issues"] if i["level"] == "warn")
    print(f"\n=== {rec['folder']} ===")
    print(f"kdenlive={rec.get('kdenlive')} errors={errs} warns={warns}")
    if rec.get("first_in"):
        print(
            f"  first_in={rec['first_in']}  "
            f"original_frames={rec.get('original_frames')}  "
            f"proxy_frames={rec.get('proxy_frames')}"
        )
    for i in rec["issues"]:
        print(f"  {i['level'].upper():5} {i['code']:16} {i['msg']}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Check FanMix Kdenlive projects for 1-frame and A/V sync issues")
    ap.add_argument("--project", type=Path, action="append")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--root", type=Path, default=ROOT / "FanMixes")
    ap.add_argument("--no-probe", action="store_true", help="Skip ffprobe (faster; no frame-count compare)")
    args = ap.parse_args()
    folders: list[Path] = []
    if args.project:
        folders.extend(p.resolve() for p in args.project)
    if args.all:
        folders = sorted(p for p in args.root.iterdir() if p.is_dir())
    if not folders:
        raise SystemExit("pass --project or --all")
    worst = 0
    for folder in folders:
        if "enhanced citations" in folder.name.lower():
            continue
        rec = check_project(folder, probe=not args.no_probe)
        print_rec(rec)
        if any(i["level"] == "error" for i in rec["issues"]):
            worst = 1
    return worst


if __name__ == "__main__":
    raise SystemExit(main())
