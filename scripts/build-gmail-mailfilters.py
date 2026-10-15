#!/usr/bin/env python3
"""Rebuild Gmail mailFilters.xml (filters + canned responses) for Flashback.

Reads the exported filters XML (Drive folder links + filter subjects), refreshes
template bodies from project READMEs, and points every reply at
flashbackrepository.org (library, motivation, request) plus the shared
“all FanEdit downloads” Drive folder.

Usage:
  python3 scripts/build-gmail-mailfilters.py \\
    --source /media/ari/HD/Downloads/mailFilters.xml \\
    --out gmail/mailFilters.xml

Import: Gmail → Settings → Filters → Delete old Request:* filters (and matching
templates if you prefer a clean slate) → Import filters → choose this file.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

REPO = Path(__file__).resolve().parents[1]
ALL_DOWNLOADS = (
    "https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link"
)
SITE = "https://flashbackrepository.org"
MOTIVATION = f"{SITE}/motivation"
REQUEST = f"{SITE}/request"
LIBRARY = f"{SITE}/"
GITLAB = "https://gitlab.com/clevertree/fan-edits"

# Filter subject → index slug (Sonic Trilogy is a combo reply, not a catalog slug)
SUBJECT_TO_SLUG = {
    "Request: Alien Resurrection UnJossed": "alien-resurrection-1997-unjossed",
    "Request: Congo Incel": "congo-1995-incel",
    "Request: Final Fantasy The Phantom Menace": "final-fantasy-2001-the-phantom-menace",
    "Request: Matrix Reloaded Unlinked": "matrix-reloaded-2003-unlinked",
    "Request: Matrix Revolutions Unlinked": "matrix-revolutions-2003-unlinked",
    "Request: Riddick Unjinxed": "riddick-2013-unjinxed",
    "Request: Silent Hill Nay Tomorrow": "silent-hill-2006-nay-tomorrow",
    "Request: Sonic DeSchwartzed": "sonic-2020-deschwartzed",
    "Request: Sonic 2 DeSchwartzed": "sonic-2-2022-deschwartzed",
    "Request: Sonic 3 DeSchwartzed": "sonic-3-2024-deschwartzed",
    "Request: Terminator 3 Brass Monkey": "terminator-3-2003-brass-monkey",
    "Request: The Chronicles Of Riddick Fry's Edition": "the-chronicles-of-riddick-2004-fry-s-edition",
    "Request: The Day After Tomorrow Yuppocolypse": "the-day-after-tomorrow-2004-yuppocolypse",
    "Request: War of the Worlds Family Therapy": "war-of-the-worlds-2005-family-therapy",
    "Request: Sonic Trilogy DeShwartzed": None,
}


def local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def clean_drive_url(url: str) -> str:
    u = html.unescape(url or "")
    # ASU Proofpoint / urldefense wrapper
    m = re.search(r"https://urldefense\.com/v3/__(https://drive\.google\.com/[^_]+?)__", u)
    if m:
        u = m.group(1)
    # Bare drive folder or file id — ignore glued Proofpoint tails
    m = re.search(
        r"(https://drive\.google\.com/(?:drive/folders|file/d)/[A-Za-z0-9_-]+)",
        u,
    )
    if not m:
        return ""
    base = m.group(1)
    if "/file/d/" in base:
        return base + "/view?usp=drive_link"
    return base + "?usp=drive_link"


def extract_from_export(path: Path):
    root = ET.fromstring(path.read_text(encoding="utf-8"))
    filters = []
    templates = {}
    for entry in root:
        if local(entry.tag) != "entry":
            continue
        cat = None
        for c in entry:
            if local(c.tag) == "category":
                cat = c.attrib.get("term")
        if cat == "filter":
            props = {}
            fid = None
            for p in entry:
                t = local(p.tag)
                if t == "id":
                    fid = (p.text or "").strip()
                elif t == "property":
                    props[p.attrib.get("name")] = p.attrib.get("value")
            if props.get("subject"):
                props["_id"] = fid
                filters.append(props)
        elif cat == "cannedResponse":
            eid = title = content_html = None
            for c in entry:
                t = local(c.tag)
                if t == "id":
                    eid = (c.text or "").strip()
                elif t == "title":
                    title = (c.text or "").strip()
                elif t == "content":
                    content_html = c.text or ""
            if not eid:
                continue
            text = html.unescape(content_html or "")
            drives = []
            for m in re.finditer(r'href="([^"]+)"', text):
                u = clean_drive_url(m.group(1))
                if not u or ALL_DOWNLOADS.split("?")[0] in u:
                    continue
                if u not in drives:
                    drives.append(u)
            templates[eid] = {"title": title, "drives": drives}
    return filters, templates


def md_inline_to_text(s: str) -> str:
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = s.replace("**", "").replace("*", "")
    return s


def read_readme_sections(readme_path: Path) -> dict:
    """Pull title + blurb-ish sections from a project README."""
    if not readme_path.is_file():
        return {"heading": "", "changes_html": "<p><em>See the title page on Flashback Repository.</em></p>"}
    text = readme_path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    heading = ""
    for ln in lines:
        if ln.startswith("# "):
            heading = ln[2:].strip()
            break

    # Prefer ## Changes / ## What changed / first substantial ## section after title
    sections: list[tuple[str, list[str]]] = []
    cur_name = None
    cur: list[str] = []
    for ln in lines:
        if ln.startswith("## "):
            if cur_name is not None:
                sections.append((cur_name, cur))
            cur_name = ln[3:].strip()
            cur = []
        elif cur_name is not None:
            cur.append(ln)
    if cur_name is not None:
        sections.append((cur_name, cur))

    prefer = ("changes", "what changed", "cut list", "description", "summary")
    body_lines: list[str] = []
    chosen = ""
    for name, body in sections:
        key = name.lower()
        if any(p in key for p in prefer):
            chosen = name
            body_lines = body
            break
    if not body_lines and sections:
        chosen = sections[0][0]
        body_lines = sections[0][1]

    # Prefer prose; skip cut-list TODOs / deep-link play rows
    kept = []
    for ln in body_lines:
        s = ln.rstrip()
        if s.startswith("#"):
            break
        if s.strip() == "---":
            break
        low = s.lower()
        if "todo" in low or "?t=" in s or "](?t=" in s or "changetime" in low:
            continue
        if re.match(r"^[-*]\s*removal\b", low):
            continue
        kept.append(s)
        if sum(1 for x in kept if x.strip()) >= 10:
            break
    para = "\n".join(kept).strip()
    if not para:
        para = "See the title page on Flashback Repository for the full cut notes."
    # markdown-ish → simple HTML paragraphs / lists
    html_parts = []
    in_list = False
    for ln in para.splitlines():
        t = ln.strip()
        if not t:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            continue
        t = md_inline_to_text(t)
        if t.startswith(("- ", "* ")):
            if not in_list:
                html_parts.append("<ul>")
                in_list = True
            html_parts.append(f"<li>{html.escape(t[2:].strip())}</li>")
        else:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            html_parts.append(f"<p>{html.escape(t)}</p>")
    if in_list:
        html_parts.append("</ul>")
    changes = "\n".join(html_parts)
    if chosen and "todo" not in chosen.lower():
        changes = f"<h2>{html.escape(chosen)}</h2>\n{changes}"
    return {"heading": heading, "changes_html": changes}


def esc_xml_text(s: str) -> str:
    """Escape for XML text / attribute values (Gmail uses &apos; in attrs)."""
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def esc_gmail_html(s: str) -> str:
    """Escape HTML for <content type='html'> the way Gmail exports it.

    Keep double-quotes as literal " (dir="ltr", href="…").
    Apostrophes become the literal characters &amp;#39; in the XML file
    (same as Gmail's export). Do not emit bare &#39; — that breaks import.
    """
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("'", "&amp;#39;")
    )


def build_template_html(
    *,
    display_title: str,
    heading: str,
    changes_html: str,
    drive_links: list[tuple[str, str]],
) -> str:
    """drive_links: list of (label, url)."""
    h1 = heading or display_title

    def a(url: str, label: str) -> str:
        # Raw " in href — matches Gmail export
        return f'<a href="{url}">{html.escape(label)}</a>'

    dl_parts = []
    for label, url in drive_links:
        dl_parts.append(f"<p>{a(url, label)}</p>")
    downloads = "\n".join(dl_parts) if dl_parts else (
        f"<p>Download folder: see {a(ALL_DOWNLOADS, 'All FanEdit downloads')}.</p>"
    )
    inner = f"""<div dir="ltr"><div class="gmail_quote">
<p>Welcome to Ari's Flashback Repository answering machine.</p>
<p>This is an automatic reply with the <strong>full-quality HEVC Matroska</strong> download for the title you requested. Own a legal copy of the commercial original before you watch the edit.</p>
<p><strong>Your download:</strong></p>
{downloads}
<h1>{html.escape(h1)}</h1>
{changes_html}
<h2>Flashback Repository</h2>
<p>{a(LIBRARY, 'Library / Now Showing')} — stream seeded titles in VLC</p>
<p>{a(REQUEST, 'Request any title')} — email form with the correct subject line</p>
<p>{a(MOTIVATION, "Why we're doing this")} — ownership, craft, and culture</p>
<p>{a(SITE + '/setup', 'Setup for playback')} — VLC / vlc:// one-click</p>
<h2>Additional links</h2>
<p>{a(ALL_DOWNLOADS, 'All of my FanEdit downloads')} (Google Drive)</p>
<p>{a(GITLAB, 'Source READMEs and project files on GitLab')}</p>
<p>Thanks for watching — feedback welcome on the {a(SITE + '/board', 'Board')}.</p>
<p>-Ari</p>
</div></div>"""
    return esc_gmail_html(inner)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--also", type=Path, action="append", default=[], help="Extra output paths")
    args = ap.parse_args()

    index = json.loads((REPO / "index.json").read_text(encoding="utf-8"))
    by_slug = {p["slug"]: p for p in index.get("projects") or []}

    filters, templates = extract_from_export(args.source)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Build Atom feed manually for predictable escaping
    filter_ids = []
    filter_entries = []
    canned_entries = []

    # Fresh IDs so import creates new templates (reuse of deleted/partial IDs →
    # "Unable to create template" in Gmail).
    stamp = f"{int(time.time()):x}"

    for f in filters:
        subject = f["subject"]
        old_canned = f.get("cannedResponse") or ""
        digest = hashlib.sha1(f"{subject}|{stamp}".encode()).hexdigest()[:16]
        canned_id = f"tag:mail.google.com,2009:cannedResponse:{digest}"
        fid = f"tag:mail.google.com,2008:filter:z{stamp}*{digest}"
        filter_ids.append(fid.split("filter:")[-1])
        mark = f.get("shouldMarkAsRead") == "true"
        tmpl = templates.get(old_canned) or {"title": subject, "drives": []}
        template_title = tmpl["title"] or subject
        drives = [clean_drive_url(d) for d in tmpl["drives"]]
        drives = [d for d in drives if d]

        slug = SUBJECT_TO_SLUG.get(subject)
        heading = ""
        changes_html = "<p><em>See the title page on Flashback Repository.</em></p>"
        display = template_title.replace("Request: ", "")
        drive_links: list[tuple[str, str]] = []

        if subject == "Request: Sonic Trilogy DeShwartzed":
            heading = "Sonic Trilogy — DeSchwartzed"
            # Prefer three links if present
            labels = [
                "Sonic (2020) - DeSchwartzed",
                "Sonic 2 (2022) - DeSchwartzed",
                "Sonic 3 (2024) - DeSchwartzed",
            ]
            for i, url in enumerate(drives[:3]):
                drive_links.append((labels[i] if i < len(labels) else f"Download {i+1}", url))
            # README from sonic 1 if present
            p = by_slug.get("sonic-2020-deschwartzed")
            if p:
                info = read_readme_sections(REPO / p["path"] / "README.md")
                changes_html = info["changes_html"]
                if info["heading"]:
                    heading = info["heading"]
        else:
            p = by_slug.get(slug) if slug else None
            if p:
                display = p.get("title") or display
                info = read_readme_sections(REPO / p["path"] / "README.md")
                heading = info["heading"] or display
                changes_html = info["changes_html"]
                blurb = (p.get("blurb") or "").strip()
                if blurb and "<p>" not in changes_html[:80]:
                    changes_html = (
                        f"<p>{html.escape(md_inline_to_text(blurb))}</p>\n{changes_html}"
                    )
            if drives:
                drive_links.append((display, drives[0]))
            elif p and p.get("media"):
                # No drive folder — still useful site link
                drive_links = []

        body_escaped = build_template_html(
            display_title=display,
            heading=heading or display,
            changes_html=changes_html,
            drive_links=drive_links,
        )

        mark_xml = (
            "\n\t\t<apps:property name='shouldMarkAsRead' value='true'/>" if mark else ""
        )
        filter_entries.append(
            f"""\t<entry>
\t\t<category term='filter'></category>
\t\t<title>Mail Filter</title>
\t\t<id>{esc_xml_text(fid)}</id>
\t\t<updated>{now}</updated>
\t\t<content></content>
\t\t<apps:property name='subject' value='{esc_xml_text(subject)}'/>{mark_xml}
\t\t<apps:property name='cannedResponse' value='{esc_xml_text(canned_id)}'/>
\t\t<apps:property name='sizeOperator' value='s_sl'/>
\t\t<apps:property name='sizeUnit' value='s_smb'/>
\t</entry>"""
        )
        canned_entries.append(
            f"""\t<entry>
\t\t<category term='cannedResponse'></category>
\t\t<title>{esc_xml_text(template_title)}</title>
\t\t<id>{esc_xml_text(canned_id)}</id>
\t\t<updated>{now}</updated>
\t\t<content type='html'>{body_escaped}</content>
\t</entry>"""
        )

    feed_id = "tag:mail.google.com,2008:filters:" + ",".join(filter_ids)
    xml = f"""<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns='http://www.w3.org/2005/Atom' xmlns:apps='http://schemas.google.com/apps/2006'>
\t<title>Mail Filters</title>
\t<id>{esc_xml_text(feed_id)}</id>
\t<updated>{now}</updated>
\t<author>
\t\t<name>Ariel Asulin</name>
\t\t<email>arasulin@asu.edu</email>
\t</author>
{chr(10).join(filter_entries)}
{chr(10).join(canned_entries)}
</feed>
"""
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(xml, encoding="utf-8")
    print(f"wrote {args.out} ({len(filters)} filters)")
    for also in args.also:
        also.parent.mkdir(parents=True, exist_ok=True)
        also.write_text(xml, encoding="utf-8")
        print(f"wrote {also}")

    # quick sanity
    for needle in (SITE, MOTIVATION, REQUEST, ALL_DOWNLOADS, "Flashback Repository"):
        assert needle in xml or html.escape(needle) in xml, needle
    print("sanity ok: site + motivation + request + all-downloads present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
