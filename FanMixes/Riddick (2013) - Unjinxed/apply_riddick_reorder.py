#!/usr/bin/env python3
"""Apply flashback-prologue reorder to Riddick Unjinxed.kdenlive and regen shifted subs."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent.parent / "scripts"))

from kdenlive_from_subs import Cue, build_ass, build_shifted_srt, parse_srt  # noqa: E402

KDENLIVE = ROOT / "Riddick (2013) - Unjinxed.kdenlive"
SRT = ROOT / "Riddick (2013) - Unjinxed.srt"

# Kept segments (source seconds) — prologue + main + tail from existing playlist2
KEPT_NEW_HEAD: list[tuple[float, float]] = [
    (10 * 60 + 54.487, 13 * 60 + 25.067),
    (15 * 60 + 50.717, 22 * 60 + 51.536),
    (1 * 60 + 13.573, 10 * 60 + 54.487),
    (22 * 60 + 51.536, 24 * 60 + 3.733),
    (24 * 60 + 3.733, 40 * 60 + 50.342),
]

TAIL_ENTRIES = """
  <entry in="00:44:11.094" out="00:55:17.893" producer="chain2">
   <property name="kdenlive:id">4</property>
   <filter id="filter7" in="00:44:11.094" out="00:44:18.060">
    <property name="start">1</property>
    <property name="level">1</property>
    <property name="mlt_service">brightness</property>
    <property name="kdenlive_id">fade_from_black</property>
    <property name="alpha">00:00:00.000=0;00:00:06.965=1</property>
    <property name="kdenlive:collapsed">0</property>
   </filter>
  </entry>
  <entry in="00:55:37.955" out="01:04:22.147" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:06:42.000" out="01:08:02.669" producer="chain2">
   <property name="kdenlive:id">4</property>
   <filter id="filter8" in="01:06:42.000" out="01:06:45.087">
    <property name="start">1</property>
    <property name="level">1</property>
    <property name="mlt_service">brightness</property>
    <property name="kdenlive_id">fade_from_black</property>
    <property name="alpha">00:00:00.000=0;00:00:03.086=1</property>
    <property name="kdenlive:collapsed">0</property>
   </filter>
  </entry>
  <entry in="01:08:59.643" out="01:10:30.113" producer="chain2">
   <property name="kdenlive:id">4</property>
   <filter id="filter9" in="01:08:59.643" out="01:09:04.796">
    <property name="start">1</property>
    <property name="level">1</property>
    <property name="mlt_service">brightness</property>
    <property name="kdenlive_id">fade_from_black</property>
    <property name="alpha">00:00:00.000=0;00:00:05.172=1</property>
   </filter>
  </entry>
  <entry in="01:14:19.853" out="01:22:34.493" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:22:34.534" out="01:22:44.294" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:24:23.273" out="01:24:36.787" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:24:36.828" out="01:24:38.830" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:24:40.874" out="01:24:43.168" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:24:43.210" out="01:24:48.632" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:24:53.720" out="01:25:25.275" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:25:27.319" out="01:25:45.337" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:26:16.391" out="01:26:27.569" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:26:27.611" out="01:28:14.514" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:28:36.578" out="01:29:25.150" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="02:59:55.722" out="02:59:57.266" producer="producer2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:29:58.684" out="01:30:23.357" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:31:27.819" out="01:36:04.046" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:37:07.591" out="01:38:36.995" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:38:37.037" out="01:38:55.764" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:39:06.840" out="01:39:13.305" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:39:32.783" out="01:39:40.916" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:39:40.958" out="01:40:14.223" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:40:32.783" out="01:41:27.444" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:41:38.497" out="01:45:10.969" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="01:45:21.563" out="01:59:02.711" producer="chain2">
   <property name="kdenlive:id">4</property>
   <filter id="filter10" in="01:59:00.334" out="01:59:03.253">
    <property name="start">1</property>
    <property name="level">1</property>
    <property name="mlt_service">brightness</property>
    <property name="kdenlive_id">fade_to_black</property>
    <property name="alpha">00:00:00.000=1;00:00:02.920=0</property>
    <property name="kdenlive:collapsed">0</property>
   </filter>
  </entry>
  <entry in="01:59:09.426" out="01:59:31.198" producer="chain2">
   <property name="kdenlive:id">4</property>
   <filter id="filter11" in="01:59:08.926" out="01:59:15.224">
    <property name="start">1</property>
    <property name="level">1</property>
    <property name="mlt_service">brightness</property>
    <property name="kdenlive_id">fade_from_black</property>
    <property name="alpha">00:00:00.000=0;00:00:06.298=1</property>
    <property name="kdenlive:collapsed">0</property>
   </filter>
  </entry>
  <entry in="01:59:31.240" out="02:06:47.631" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
"""


def tc_to_sec(tc: str) -> float:
    h, m, rest = tc.split(":")
    s, ms = rest.split(".")
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0


def sec_to_tc(sec: float) -> str:
    h = int(sec // 3600)
    sec -= h * 3600
    m = int(sec // 60)
    sec -= m * 60
    s = int(sec)
    ms = int(round((sec - s) * 1000))
    if ms >= 1000:
        ms = 0
        s += 1
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


TAIL_KEPT: list[tuple[float, float]] = [
    (44 * 60 + 11.094, 55 * 60 + 17.893),
    (55 * 60 + 37.955, 64 * 60 + 22.147),
    (66 * 60 + 42.0, 68 * 60 + 2.669),
    (68 * 60 + 59.643, 70 * 60 + 30.113),
    (74 * 60 + 19.853, 82 * 60 + 34.493),
    (82 * 60 + 34.534, 82 * 60 + 44.294),
    (84 * 60 + 23.273, 84 * 60 + 36.787),
    (84 * 60 + 36.828, 84 * 60 + 38.830),
    (84 * 60 + 40.874, 84 * 60 + 43.168),
    (84 * 60 + 43.210, 84 * 60 + 48.632),
    (84 * 60 + 53.720, 85 * 60 + 25.275),
    (85 * 60 + 27.319, 85 * 60 + 45.337),
    (86 * 60 + 16.391, 86 * 60 + 27.569),
    (86 * 60 + 27.611, 88 * 60 + 14.514),
    (88 * 60 + 36.578, 89 * 60 + 25.150),
    (89 * 60 + 58.684, 90 * 60 + 23.357),
    (91 * 60 + 27.819, 96 * 60 + 4.046),
    (97 * 60 + 7.591, 98 * 60 + 36.995),
    (98 * 60 + 37.037, 98 * 60 + 55.764),
    (99 * 60 + 6.840, 99 * 60 + 13.305),
    (99 * 60 + 32.783, 99 * 60 + 40.916),
    (99 * 60 + 40.958, 100 * 60 + 14.223),
    (100 * 60 + 32.783, 101 * 60 + 27.444),
    (101 * 60 + 38.497, 105 * 60 + 10.969),
    (105 * 60 + 21.563, 119 * 60 + 2.711),
    (119 * 60 + 9.426, 119 * 60 + 31.198),
    (119 * 60 + 31.240, 126 * 60 + 47.631),
]


def build_playlist2() -> str:
    head = """ <playlist id="playlist2">
  <entry in="00:10:54.487" out="00:13:25.067" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="00:15:50.717" out="00:22:51.536" producer="chain2">
   <property name="kdenlive:id">4</property>
   <filter id="filter12" in="00:22:49.076" out="00:22:51.536">
    <property name="start">1</property>
    <property name="level">1</property>
    <property name="mlt_service">brightness</property>
    <property name="kdenlive_id">fade_to_black</property>
    <property name="alpha">00:00:00.000=1;00:00:02.460=0</property>
   </filter>
  </entry>
  <entry in="00:01:13.573" out="00:10:54.487" producer="chain2">
   <property name="kdenlive:id">4</property>
   <filter id="filter13" in="00:01:13.573" out="00:01:16.659">
    <property name="start">1</property>
    <property name="level">1</property>
    <property name="mlt_service">brightness</property>
    <property name="kdenlive_id">fade_from_black</property>
    <property name="alpha">00:00:00.000=0;00:00:03.086=1</property>
    <property name="kdenlive:collapsed">0</property>
   </filter>
  </entry>
  <entry in="00:22:51.536" out="00:24:03.733" producer="chain2">
   <property name="kdenlive:id">4</property>
  </entry>
  <entry in="00:24:03.733" out="00:40:50.342" producer="chain2">
   <property name="kdenlive:id">4</property>
   <filter id="filter6" in="00:40:48.882" out="00:40:50.342">
    <property name="start">1</property>
    <property name="level">1</property>
    <property name="mlt_service">brightness</property>
    <property name="kdenlive_id">fade_to_black</property>
    <property name="alpha">00:00:00.000=1;00:00:01.460=0</property>
   </filter>
  </entry>
"""
    return head + TAIL_ENTRIES + " </playlist>\n"


def total_out_sec(kept: list[tuple[float, float]]) -> float:
    return sum(b - a for a, b in kept)


def main() -> None:
    text = KDENLIVE.read_text(encoding="utf-8")
    new_pl = build_playlist2()
    text, n = re.subn(
        r" <playlist id=\"playlist2\">.*?</playlist>\n",
        new_pl,
        text,
        count=1,
        flags=re.DOTALL,
    )
    if n != 1:
        raise SystemExit("playlist2 replace failed")

    all_kept = KEPT_NEW_HEAD + TAIL_KEPT
    out_dur = total_out_sec(all_kept)
    out_tc = sec_to_tc(out_dur - 1 / 24)  # frame-ish trim for MLT out

    text = re.sub(
        r'(<tractor id="tractor1" in="00:00:00.000" out=")[^"]+(")',
        rf"\g<1>{out_tc}\2",
        text,
        count=1,
    )
    text = re.sub(
        r'(<tractor id="tractor2" in="00:00:00.000" out=")[^"]+(")',
        rf"\g<1>{out_tc}\2",
        text,
        count=1,
    )
    dur_prop = out_tc.replace(".", ":")
    if len(dur_prop.split(":")[-1]) > 3:
        parts = dur_prop.split(":")
        dur_prop = f"{parts[0]}:{parts[1]}:{parts[2]}.{parts[3][:3]}" if len(parts) > 3 else dur_prop
    # kdenlive:duration uses HH:MM:SS.mmm style in file
    dur_kd = out_tc
    text = re.sub(
        r'(<tractor id="tractor2" in="00:00:00.000" out="[^"]+">\s*<property name="kdenlive:duration">)[^<]+',
        rf"\g<1>{dur_kd}",
        text,
        count=1,
    )
    text = re.sub(
        r'(<tractor id="tractor3" in="00:00:00.000" out=")[^"]+(")',
        rf"\g<1>{out_tc}\2",
        text,
        count=1,
    )
    track_pat = r'(<track in="00:00:00.000" out=")[^"]+(" producer="tractor2"/>)'
    text = re.sub(track_pat, rf"\g<1>{out_tc}\2", text, count=1)

    KDENLIVE.write_text(text, encoding="utf-8")
    print(f"Updated {KDENLIVE.name} duration ~{out_tc}")

    cues = parse_srt(SRT)
    all_kept_full = KEPT_NEW_HEAD + TAIL_KEPT
    shifted = build_shifted_srt(cues, all_kept_full)
    ass = build_ass(cues, all_kept_full)
    (ROOT / "Riddick (2013) - Unjinxed.kdenlive.shifted.srt").write_text(
        shifted, encoding="utf-8"
    )
    (ROOT / "Riddick (2013) - Unjinxed.kdenlive.ass").write_text(ass, encoding="utf-8")
    print("Wrote shifted SRT and ASS")


if __name__ == "__main__":
    main()
