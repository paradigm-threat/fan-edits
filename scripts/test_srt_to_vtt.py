#!/usr/bin/env python3
"""Quick self-check for srt_to_vtt conversion."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from srt_to_vtt import convert_file, srt_text_to_vtt

SAMPLE = """1
00:00:01,000 --> 00:00:03,500
Hello world

2
00:01:00,100 --> 00:01:02,000
Second cue
"""


def main() -> None:
    vtt = srt_text_to_vtt(SAMPLE)
    assert vtt.startswith("WEBVTT\n")
    assert "00:00:01.000 --> 00:00:03.500" in vtt
    assert "Hello world" in vtt
    assert "," not in vtt.split("-->")[0].split("\n")[-1]  # no comma in first TS line area
    with tempfile.TemporaryDirectory() as td:
        srt = Path(td) / "a.srt"
        srt.write_text(SAMPLE, encoding="utf-8")
        out = convert_file(srt)
        assert out.suffix == ".vtt"
        assert "WEBVTT" in out.read_text(encoding="utf-8")
    print("ok")


if __name__ == "__main__":
    main()
