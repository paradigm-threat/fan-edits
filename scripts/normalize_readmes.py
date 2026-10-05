#!/usr/bin/env python3
"""Normalize project READMEs to: Title, description, Motivation, Changes, then rest.

Preserves author voice where possible. Adds TODO bullets for undocumented range cuts.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_HEADS = {
    "description",
    "motivation",
    "changes",
    "change-list",
    "why this edit",
    "goals",
    "synopsis",
}


def split_sections(text: str) -> tuple[str, str, list[tuple[str, str]]]:
    lines = text.splitlines()
    title = ""
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    if i < len(lines) and lines[i].startswith("# "):
        title = lines[i][2:].strip()
        i += 1
    # preamble until first ##
    pre: list[str] = []
    while i < len(lines) and not lines[i].startswith("## "):
        pre.append(lines[i])
        i += 1
    sections: list[tuple[str, str]] = []
    while i < len(lines):
        head = lines[i][3:].strip()
        i += 1
        body: list[str] = []
        while i < len(lines) and not lines[i].startswith("## "):
            body.append(lines[i])
            i += 1
        sections.append((head, "\n".join(body).strip("\n")))
    return title, "\n".join(pre).strip(), sections


def first_para(text: str) -> str:
    chunks = re.split(r"\n\s*\n", text.strip())
    for c in chunks:
        t = c.strip()
        if not t or t.startswith("#") or t.startswith("```") or t.startswith("|"):
            continue
        if t.startswith("- ") or t.startswith("* "):
            continue
        return re.sub(r"\s+", " ", t)
    return ""


def bullets_from_prose(text: str) -> list[str]:
    out: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("- ") or s.startswith("* "):
            out.append(s[2:].strip())
        elif s.startswith("|") and "---" not in s and not s.startswith("| Decision"):
            cells = [c.strip() for c in s.strip("|").split("|")]
            if len(cells) >= 2 and cells[0] and cells[0].lower() not in ("decision", ""):
                out.append(f"{cells[0]} — {cells[1]}")
    if out:
        return out
    # sentence-ish splits from prose Changes
    para = re.sub(r"\s+", " ", text.strip())
    if not para:
        return []
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z])", para)
    for p in parts:
        p = p.strip()
        if len(p) > 24:
            out.append(p)
    return out[:20]


def load_range_notes(proj: Path) -> tuple[str, list[str], list[tuple[float, float]]]:
    desc = ""
    notes: list[str] = []
    bare: list[tuple[float, float]] = []
    for p in sorted(proj.glob("remove-*-ranges.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(data, dict):
            desc = (data.get("description") or desc or "").strip()
            ranges = data.get("ranges") or []
        else:
            ranges = data
        if not isinstance(ranges, list):
            continue
        for r in ranges:
            if isinstance(r, dict):
                note = (r.get("note") or "").strip()
                if note:
                    notes.append(note)
                else:
                    try:
                        bare.append((float(r["start"]), float(r["end"])))
                    except (KeyError, TypeError, ValueError):
                        pass
            elif isinstance(r, (list, tuple)) and len(r) >= 2:
                try:
                    bare.append((float(r[0]), float(r[1])))
                except (TypeError, ValueError):
                    pass
    return desc, notes, bare


def motivation_from(
    sections: dict[str, str],
    description: str,
    range_desc: str,
    title: str,
) -> str:
    for key in ("Motivation", "Why this edit", "Goals", "Synopsis"):
        if key in sections and sections[key].strip():
            # Goals often bullet-y — keep as prose block
            return sections[key].strip()
    # Infer from description / range desc / title
    bits: list[str] = []
    if description:
        bits.append(description)
    if range_desc and range_desc not in description:
        bits.append(range_desc)
    if not bits:
        bits.append(
            f"This cut exists to reshape *{title}* toward a cleaner watch — "
            "see Changes for what was removed or restored."
        )
    return "\n\n".join(bits)


def normalize_one(readme: Path) -> bool:
    raw = readme.read_text(encoding="utf-8", errors="replace")
    title, preamble, sections_list = split_sections(raw)
    if not title:
        title = readme.parent.name
    sections = {h: b for h, b in sections_list}

    # Description: preamble, or ## Description, or first Changes sentence
    description = preamble.strip()
    if sections.get("Description", "").strip():
        description = sections["Description"].strip()
    if not description:
        description = first_para(sections.get("Changes", "") or sections.get("Change-list", ""))
    if not description:
        description = first_para(sections.get("Motivation", "") or sections.get("Why this edit", ""))
    if not description:
        description = f"Fan edit of *{title}*."

    range_desc, range_notes, bare_ranges = load_range_notes(readme.parent)

    # Changes bullets
    change_bodies = []
    for k in ("Changes", "Change-list", "Cuts & Additions", "Editing Details"):
        if k in sections and sections[k].strip():
            change_bodies.append(sections[k])
    # Also Removals subsections often under Changes already
    bullets: list[str] = []
    for body in change_bodies:
        for b in bullets_from_prose(body):
            if b not in bullets:
                bullets.append(b)
    for n in range_notes:
        if n not in bullets:
            bullets.append(n)
    todos: list[str] = []
    for start, end in bare_ranges[:12]:
        todos.append(f"TODO: removal ~{start:.0f}s–{end:.0f}s (describe from timeline/subs)")
    if len(bare_ranges) > 12:
        todos.append(
            f"TODO: {len(bare_ranges) - 12} more undocumented removal window(s) in ranges JSON"
        )
    if not bullets and not todos:
        if range_desc:
            bullets.append(range_desc)
        else:
            todos.append("TODO: document each picture/audio change for this edit")

    motivation = motivation_from(sections, description, range_desc, title)
    # Avoid Motivation == Description verbatim when we only had description
    if motivation.strip() == description.strip() and range_desc and range_desc != description:
        motivation = range_desc
    if motivation.strip() == description.strip():
        motivation = (
            f"{description}\n\n"
            "More detail on *why* each beat was cut still belongs here — "
            "fill in as you QC."
        )

    # Rest: sections not folded into front matter
    rest_parts: list[str] = []
    for head, body in sections_list:
        key = head.strip()
        if key.lower() in SKIP_HEADS:
            continue
        if key.lower() in {"cuts & additions", "editing details"}:
            continue
        rest_parts.append(f"## {head}\n\n{body.strip()}\n" if body.strip() else f"## {head}\n")

    # Build
    out: list[str] = [f"# {title}", "", description.strip(), "", "## Motivation", "", motivation.strip(), "", "## Changes", ""]
    for b in bullets:
        out.append(f"- {b}")
    for t in todos:
        out.append(f"- {t}")
    out.append("")
    if rest_parts:
        out.append("")
        out.extend(rest_parts)

    new = "\n".join(out).rstrip() + "\n"
    if new == raw:
        return False
    readme.write_text(new, encoding="utf-8")
    return True


def main() -> None:
    n = 0
    for cat in ("FanMixes", "KidFriendly"):
        for readme in sorted((ROOT / cat).glob("*/README.md")):
            if normalize_one(readme):
                n += 1
                print("updated", readme.relative_to(ROOT))
            else:
                print("unchanged", readme.relative_to(ROOT))
    print(f"done, wrote {n}")


if __name__ == "__main__":
    main()
