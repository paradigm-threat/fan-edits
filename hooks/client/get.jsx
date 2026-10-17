/**
 * Flashback Repository — theater shell (SSR + hydrate).
 */
import React, { useState } from 'react'
import StyleContext from '@clevertree/style'
import { MarkdownRenderer } from '@clevertree/markdown'
import manifest from '@hooks'
import { PlayChevron } from 'hooks/client/components/Icons.jsx'
import Affirmation, {
  hasOwnershipAck,
  ensureOwnershipAckFromBrowser,
  hasMovieOwnAck,
  ensureMovieOwnAckFromBrowser,
  welcomeStorageKey,
  movieStorageKey,
} from 'hooks/client/native/Affirmation.js'
import NowShowing from 'hooks/client/native/NowShowing.js'
import ExternalPlay from 'hooks/client/native/ExternalPlay.js'
import Board from 'hooks/client/native/Board.js'
import LiveChat from 'hooks/client/native/LiveChat.js'
import ChatApp from 'hooks/client/native/ChatApp.js'
import AppDownloads from 'hooks/client/components/AppDownloads.jsx'
// SSR-static tip (`hydrate: false`): no embed.js, so gallery CEs never upgrade.

function str(v) {
  if (v === null) {
    return ''
  }
  if (typeof v === 'boolean') {
    if (v) {
      return 'true'
    }
    return 'false'
  }
  if (typeof v === 'number') {
    return '' + v
  }
  if (typeof v === 'string') {
    return v
  }
  return ''
}

function normalizeRoute(raw) {
  let t = str(raw).trim()
  if (t.length === 0) {
    return '/'
  }
  if (t.charAt(0) !== '/') {
    t = '/' + t
  }
  const q = t.indexOf('?')
  if (q >= 0) {
    t = t.slice(0, q)
  }
  if (t === '/index.md' || t === '/index.html') {
    return '/'
  }
  if (t.length > 1 && t.charAt(t.length - 1) === '/') {
    t = t.slice(0, t.length - 1)
  }
  return t
}

function initialRoute() {
  try {
    if (manifest.relayInitialPath && typeof manifest.relayInitialPath === 'string') {
      return normalizeRoute(manifest.relayInitialPath)
    }
  } catch (e) {}
  try {
    if (typeof globalThis !== 'undefined' && globalThis.location && globalThis.location.pathname) {
      return normalizeRoute(globalThis.location.pathname)
    }
  } catch (e2) {}
  return '/'
}

function mediaSrc(project) {
  if (!project || !project.media) {
    return ''
  }
  return '/' + project.path + '/' + project.media
}

/**
 * Now showing = title is uploaded on this server (tip media is playable).
 * Everyone else is IPFS / email only — never advertise tip /FanMixes/… URLs.
 */
function projectIsNowShowing(project, nowShowingSlugs) {
  if (!project) {
    return false
  }
  try {
    if (str(project.status).toLowerCase() === 'showing') {
      return true
    }
  } catch (eSt) {}
  const slug = str(project.slug)
  if (slug.length === 0 || !nowShowingSlugs) {
    return false
  }
  let i = 0
  while (i < nowShowingSlugs.length) {
    if (str(nowShowingSlugs[i]) === slug) {
      return true
    }
    i = i + 1
  }
  return false
}

function projectMediaField(project, key) {
  try {
    if (project && project[key]) {
      return str(project[key])
    }
  } catch (e) {}
  return ''
}

/** Logical URL for a basename under project.path. */
function mediaSrcFor(project, basename) {
  const base = str(basename)
  if (!project || base.length === 0) {
    return ''
  }
  const path = str(project.path)
  if (path.length === 0) {
    return ''
  }
  return '/' + path + '/' + base
}

/**
 * Push archival master first (highest quality). Host uses native HTML5 or
 * WASM demux; fall back to H.264 MP4 compatibility on failure.
 * Among MP4s: wide → 1080p then 720p; Save-Data/narrow → 720p then 1080p.
 */
function prefersDesktopPlayback() {
  try {
    const nav = globalThis.navigator
    if (nav && nav.connection && nav.connection.saveData === true) {
      return false
    }
  } catch (e) {}
  try {
    const mm = globalThis.matchMedia
    if (typeof mm === 'function') {
      if (!mm('(min-width: 901px)').matches) {
        return false
      }
    }
  } catch (e2) {}
  return true
}

function canPlayAvcMp4() {
  try {
    const doc = globalThis.document
    if (!doc || typeof doc.createElement !== 'function') {
      return true
    }
    const v = doc.createElement('video')
    const r = v.canPlayType('video/mp4; codecs="avc1.42E01E"')
    return r === 'probably' || r === 'maybe'
  } catch (e) {
    return true
  }
}

function canPlayHevcMp4() {
  try {
    const doc = globalThis.document
    if (!doc || typeof doc.createElement !== 'function') {
      return false
    }
    const v = doc.createElement('video')
    const a = v.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"')
    const b = v.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"')
    return a === 'probably' || a === 'maybe' || b === 'probably' || b === 'maybe'
  } catch (e) {
    return false
  }
}

/**
 * True only when the browser claims Matroska + HEVC in-page.
 * No major browser reports this in 2026 — in-page Play stays off.
 */
function canPlayMkvHevc() {
  try {
    const doc = globalThis.document
    if (!doc || typeof doc.createElement !== 'function') {
      return false
    }
    const v = doc.createElement('video')
    const tests = [
      'video/x-matroska; codecs="hvc1.1.6.L93.B0"',
      'video/x-matroska; codecs="hev1.1.6.L93.B0"',
      'video/matroska; codecs="hvc1.1.6.L93.B0"',
      'video/webm; codecs="hvc1.1.6.L93.B0"',
    ]
    for (let i = 0; i < tests.length; i++) {
      const r = v.canPlayType(tests[i])
      if (r === 'probably' || r === 'maybe') {
        return true
      }
    }
  } catch (e) {}
  return false
}

/** Absolute same-origin URL for VLC Open Network Stream. */
function siteOrigin() {
  try {
    const loc = globalThis.location
    if (loc && loc.origin && loc.origin.indexOf('http') === 0) {
      return loc.origin
    }
  } catch (e) {}
  return 'https://flashbackrepository.org'
}

function absoluteStreamUrl(path) {
  const p = str(path)
  if (p.length === 0) {
    return ''
  }
  if (p.indexOf('https://') === 0 || p.indexOf('http://') === 0) {
    return p
  }
  const origin = siteOrigin()
  if (p.charAt(0) === '/') {
    return origin + p
  }
  return origin + '/' + p
}

/** Basename for the HTML download attribute (Save As filename). */
function downloadBasename(pathOrUrl) {
  const raw = str(pathOrUrl)
  if (raw.length === 0) {
    return 'movie.mkv'
  }
  let path = raw
  const q = path.indexOf('?')
  if (q >= 0) {
    path = path.slice(0, q)
  }
  const slash = path.lastIndexOf('/')
  let name = slash >= 0 ? path.slice(slash + 1) : path
  // CleverScript SSR has no decodeURIComponent — never reference the bare name.
  try {
    if (typeof globalThis !== 'undefined' && globalThis.decodeURIComponent) {
      name = globalThis.decodeURIComponent(name)
    }
  } catch (eDec) {}
  if (name.length === 0) {
    return 'movie.mkv'
  }
  return name
}

/** Repo-root path for a title poster (`image` or `path` + `poster`). */
function projectPosterPath(project) {
  if (!project) {
    return ''
  }
  try {
    if (project.image) {
      let poster = str(project.image)
      if (poster.length > 0 && poster.charAt(0) !== '/') {
        poster = '/' + poster
      }
      if (poster.length > 0) {
        return poster
      }
    }
  } catch (e) {}
  // CleverScript throws on missing keys — only Now Showing titles carry `poster`.
  try {
    if (project.poster && project.path) {
      return '/' + str(project.path) + '/' + str(project.poster)
    }
  } catch (e2) {}
  return ''
}

/** Encode chars that break Markdown link targets. CleverScript has no encodeURIComponent. */
function encodeMarkdownUrl(url) {
  const raw = str(url)
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charAt(i)
    if (c === ' ') {
      out = out + '%20'
    } else if (c === '(') {
      out = out + '%28'
    } else if (c === ')') {
      out = out + '%29'
    } else if (c === "'") {
      out = out + '%27'
    } else if (c === '"') {
      out = out + '%22'
    } else {
      out = out + c
    }
  }
  return out
}

function leaveReadmeHref(href) {
  const h = str(href)
  if (h.length === 0) {
    return true
  }
  const c0 = h.charAt(0)
  if (c0 === '/' || c0 === '#' || c0 === '?') {
    return true
  }
  if (h.indexOf('http://') === 0 || h.indexOf('https://') === 0 || h.indexOf('mailto:') === 0) {
    return true
  }
  if (h.indexOf('../') === 0 || h.indexOf('./../') === 0) {
    return true
  }
  return false
}

/**
 * Find the ')' that closes a Markdown link destination starting at `open`.
 * Skips balanced inner parentheses so paths like `Foo (1999)/x.md` are safe.
 */
function markdownLinkCloseParen(raw, open) {
  let depth = 1
  let j = open
  while (j < raw.length) {
    const ch = raw.charAt(j)
    if (ch === '(') {
      depth = depth + 1
    } else if (ch === ')') {
      depth = depth - 1
      if (depth === 0) {
        return j
      }
    }
    j = j + 1
  }
  return 0 - 1
}

/**
 * README links like poster.jpg resolve against the slug URL (`/poster.jpg` → 404).
 * Rewrite same-folder targets to an absolute URL under project.path.
 * Destinations are closed with balanced-paren scan (project folders often contain `(1999)`).
 */
function rewriteReadmeAssetLinks(md, projectPath) {
  const raw = str(md)
  const base = str(projectPath)
  if (raw.length === 0 || base.length === 0) {
    return raw
  }
  let out = ''
  let i = 0
  while (i < raw.length) {
    const mark = raw.indexOf('](', i)
    if (mark < 0) {
      out = out + raw.slice(i)
      break
    }
    const close = markdownLinkCloseParen(raw, mark + 2)
    if (close < 0) {
      out = out + raw.slice(i)
      break
    }
    out = out + raw.slice(i, mark + 2)
    let href = raw.slice(mark + 2, close)
    const sp = href.indexOf(' ')
    let rest = ''
    if (sp >= 0) {
      rest = href.slice(sp)
      href = href.slice(0, sp)
    }
    if (!leaveReadmeHref(href)) {
      if (href.indexOf('./') === 0) {
        href = href.slice(2)
      }
      href = encodeMarkdownUrl(absoluteStreamUrl('/' + base + '/' + href))
    }
    out = out + href + rest + ')'
    i = close + 1
  }
  return out
}

/** Leading README poster art duplicates the catalog poster (and 404s on the slug URL). */
function isPosterMarkdownTarget(alt, href) {
  const h = str(href).toLowerCase()
  const a = str(alt).toLowerCase()
  if (
    h.indexOf('poster.jpg') >= 0 ||
    h.indexOf('poster.jpeg') >= 0 ||
    h.indexOf('poster.png') >= 0 ||
    h.indexOf('poster.webp') >= 0
  ) {
    return true
  }
  if (a.indexOf('poster') >= 0) {
    return true
  }
  return false
}

function stripLeadingPosterImage(md) {
  const raw = str(md)
  let i = 0
  while (i < raw.length) {
    const ch = raw.charAt(i)
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      i = i + 1
      continue
    }
    break
  }
  if (raw.slice(i, i + 2) !== '![') {
    return raw
  }
  const mark = raw.indexOf('](', i)
  if (mark < 0) {
    return raw
  }
  const close = markdownLinkCloseParen(raw, mark + 2)
  if (close < 0) {
    return raw
  }
  const alt = raw.slice(i + 2, mark)
  let href = raw.slice(mark + 2, close)
  const sp = href.indexOf(' ')
  if (sp >= 0) {
    href = href.slice(0, sp)
  }
  if (!isPosterMarkdownTarget(alt, href)) {
    return raw
  }
  let rest = raw.slice(close + 1)
  while (rest.charAt(0) === '\n' || rest.charAt(0) === '\r') {
    rest = rest.slice(1)
  }
  return rest
}

function pickPlayableSrc(project) {
  if (!project) {
    return ''
  }
  const mobile = projectMediaField(project, 'mediaMobile')
  const web = projectMediaField(project, 'mediaWeb')
  const master = projectMediaField(project, 'media')
  const avc = canPlayAvcMp4()
  const hevc = canPlayHevcMp4()
  const desktop = prefersDesktopPlayback()
  // HEVC archival MP4 when the browser can decode it; else H.264 web/mobile ladder.
  let order = []
  if (hevc && master.length > 0) {
    order = order.concat([master])
  }
  if (desktop) {
    if (web.length > 0 && avc) {
      order = order.concat([web])
    }
    if (mobile.length > 0 && avc) {
      order = order.concat([mobile])
    }
  } else {
    if (mobile.length > 0 && avc) {
      order = order.concat([mobile])
    }
    if (web.length > 0 && avc) {
      order = order.concat([web])
    }
  }
  if ((!hevc || order.length === 0) && master.length > 0) {
    // Last resort: try archival MP4 even if canPlayType was empty (some Chrome builds).
    let has = false
    for (let i = 0; i < order.length; i++) {
      if (order[i] === master) {
        has = true
        break
      }
    }
    if (!has) {
      order = order.concat([master])
    }
  }
  if (order.length === 0) {
    return ''
  }
  return mediaSrcFor(project, order[0])
}

function resolveCidForLogical(logical) {
  const path = str(logical)
  if (path.length === 0) {
    return ''
  }
  const stub = fetchText('.relay/assets/' + path + '.ipfs')
  return parseCidFromStub(stub)
}

/** Last path segment — folder name fallback when README has no `#` title. */
function folderNameFromPath(projectPath) {
  const p = str(projectPath)
  if (p.length === 0) {
    return ''
  }
  const parts = p.split('/')
  let last = ''
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length > 0) {
      last = parts[i]
    }
  }
  return last
}

/**
 * Scan README for leading `# title` + next lead paragraph (subtitle/blurb).
 * Returns { title, blurb, body } with hero lines excluded from body.
 * No `#` → title = folderName, body = full README.
 * CleverScript-safe.
 */
function parseReadmeHero(readme, folderName) {
  const raw = str(readme)
  const fallbackTitle = str(folderName)
  // CleverScript-safe hero strip: walk lines without regex or .push
  if (raw.length === 0) {
    return { title: fallbackTitle, blurb: '', body: '' }
  }
  const lines = raw.split('\n')
  let i = 0
  while (i < lines.length) {
    const blank = str(lines[i]).trim()
    if (blank.length > 0) {
      break
    }
    i = i + 1
  }
  if (i >= lines.length) {
    return { title: fallbackTitle, blurb: '', body: '' }
  }
  const first = str(lines[i]).trim()
  if (first.indexOf('# ') !== 0) {
    return { title: fallbackTitle, blurb: '', body: raw }
  }
  const title = first.slice(2).trim()
  i = i + 1
  while (i < lines.length) {
    const blank2 = str(lines[i]).trim()
    if (blank2.length > 0) {
      break
    }
    i = i + 1
  }
  let blurb = ''
  while (i < lines.length) {
    const s = str(lines[i]).trim()
    if (s.length === 0) {
      if (blurb.length > 0) {
        break
      }
      i = i + 1
      continue
    }
    if (s.charAt(0) === '#') {
      break
    }
    if (s.indexOf('- ') === 0 || s.indexOf('* ') === 0) {
      break
    }
    if (s.indexOf('|') === 0) {
      break
    }
    // Catalog poster is shown beside the notes; don't fold a leading poster embed into the blurb.
    if (s.indexOf('![') === 0 && s.toLowerCase().indexOf('poster') >= 0) {
      i = i + 1
      continue
    }
    if (blurb.length > 0) {
      blurb = blurb + ' '
    }
    blurb = blurb + s
    i = i + 1
    if (blurb.length > 280) {
      break
    }
  }
  while (i < lines.length) {
    const blank3 = str(lines[i]).trim()
    if (blank3.length > 0) {
      break
    }
    i = i + 1
  }
  let body = ''
  for (let j = i; j < lines.length; j++) {
    if (body.length > 0) {
      body = body + '\n'
    }
    body = body + str(lines[j])
  }
  let outTitle = fallbackTitle
  if (title.length > 0) {
    outTitle = title
  }
  return { title: outTitle, blurb: blurb, body: body }
}

/** Parse ?t= / #t= / 1:23 / 90s — CleverScript-safe (no regex literals). */
function isPlainNumberString(s) {
  if (s.length === 0) {
    return false
  }
  let dot = 0
  const digits = '0123456789'
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i)
    if (c === '.') {
      dot = dot + 1
      if (dot > 1) {
        return false
      }
    } else if (digits.indexOf(c) < 0) {
      return false
    }
  }
  return true
}

function queryParam(search, key) {
  const needle = key + '='
  const variants = ['?' + needle, '&' + needle]
  for (let v = 0; v < variants.length; v++) {
    const idx = search.indexOf(variants[v])
    if (idx < 0) {
      continue
    }
    let start = idx + variants[v].length
    let end = search.indexOf('&', start)
    if (end < 0) {
      end = search.length
    }
    return search.slice(start, end)
  }
  return ''
}

function boardQueryFromLocation() {
  let path = '/'
  let kind = 'comment'
  try {
    const loc = typeof globalThis !== 'undefined' ? globalThis.location : null
    if (loc && loc.search) {
      const q = loc.search
      const rawPath = queryParam(q, 'path')
      if (rawPath.length > 0) {
        try {
          path = globalThis.decodeURIComponent
            ? globalThis.decodeURIComponent(rawPath)
            : rawPath
        } catch (e) {
          path = rawPath
        }
        if (path.charAt(0) !== '/') {
          path = '/' + path
        }
      } else if (loc.pathname && loc.pathname !== '/board') {
        path = normalizeRoute(loc.pathname)
      }
      const rawKind = queryParam(q, 'kind')
      if (rawKind === 'bug' || rawKind === 'review' || rawKind === 'comment') {
        kind = rawKind
      }
    }
  } catch (e2) {}
  return { path: path, kind: kind }
}

function parseMediaTime(raw) {
  let s = str(raw).trim()
  if (s.length === 0) {
    return 0 - 1
  }
  if (s.indexOf('t=') === 0) {
    s = s.slice(2)
  }
  const comma = s.indexOf(',')
  if (comma >= 0) {
    s = s.slice(0, comma)
  }
  if (s.length > 0 && s.charAt(s.length - 1) === 's') {
    s = s.slice(0, s.length - 1)
  }
  if (isPlainNumberString(s)) {
    return parseFloat(s)
  }
  const parts = s.split(':')
  if (parts.length === 2 && isPlainNumberString(parts[0]) && isPlainNumberString(parts[1])) {
    return parseInt(parts[0], 10) * 60 + parseFloat(parts[1])
  }
  if (
    parts.length === 3 &&
    isPlainNumberString(parts[0]) &&
    isPlainNumberString(parts[1]) &&
    isPlainNumberString(parts[2])
  ) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2])
  }
  return 0 - 1
}

function startAtFromLocation() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.location) {
      return 0 - 1
    }
    const loc = globalThis.location
    if (loc.search) {
      const q = loc.search
      const keys = ['t', 'start', 'time']
      for (let i = 0; i < keys.length; i++) {
        const rawVal = queryParam(q, keys[i])
        if (rawVal.length > 0) {
          let decoded = rawVal
          try {
            if (typeof globalThis !== 'undefined' && globalThis.decodeURIComponent) {
              decoded = globalThis.decodeURIComponent(rawVal)
            }
          } catch (eDec) {}
          const n = parseMediaTime(decoded)
          if (n >= 0) {
            return n
          }
        }
      }
    }
    if (loc.hash) {
      let h = loc.hash
      if (h.charAt(0) === '#') {
        h = h.slice(1)
      }
      if (h.indexOf('t=') === 0) {
        const n = parseMediaTime(h)
        if (n >= 0) {
          return n
        }
      }
    }
  } catch (e) {}
  return 0 - 1
}

function theaterHostEl() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.document) {
      return null
    }
    const doc = globalThis.document
    if (!doc.querySelector) {
      return null
    }
    return doc.querySelector('[data-relay-park-native="fb-theater-player"]')
  } catch (e) {
    return null
  }
}

function pushTheaterCommand(playingFlag, commandVal, seqVal) {
  try {
    const host = theaterHostEl()
    if (!host || !host.setAttribute) {
      return
    }
    host.setAttribute('data-playing', playingFlag)
    host.setAttribute('data-command', '' + commandVal)
    host.setAttribute('data-command-seq', '' + seqVal)
  } catch (e) {}
}

function subtitleTracks(project) {
  if (!project || !project.subtitles) {
    return []
  }
  let out = []
  const list = project.subtitles
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    const track = {
      src: t.src.charAt(0) === '/' ? t.src : '/' + t.src,
      label: t.label || 'Subtitles',
      lang: t.lang || 'en',
    }
    if (t.default === true) {
      track.default = true
    }
    out = out.concat([track])
  }
  return out
}

function findProject(projects, slug) {
  for (let i = 0; i < projects.length; i++) {
    if (projects[i].slug === slug) {
      return projects[i]
    }
  }
  return null
}

/** CleverScript-safe: optional index fields via try/catch. */
function projectOriginalTitle(p) {
  try {
    if (p && p.originalTitle) {
      return str(p.originalTitle)
    }
  } catch (e) {}
  return ''
}

function projectTitle(p) {
  try {
    if (p && p.title) {
      return str(p.title)
    }
  } catch (e) {}
  return ''
}

function projectsInCategory(projects, category) {
  let out = []
  for (let i = 0; i < projects.length; i++) {
    if (projects[i].category === category) {
      out = out.concat([projects[i]])
    }
  }
  return out
}

function fetchText(path) {
  try {
    let p = str(path)
    if (p.charAt(0) === '/') {
      p = p.slice(1)
    }
    // SSR RepoFetchHost reads git paths in-process — keep spaces/parens unencoded.
    const res = fetch('/' + p)
    if (res && res.ok === true && res.text) {
      return res.text
    }
  } catch (e) {}
  return ''
}

function formatFileBytes(n) {
  const v = typeof n === 'number' ? n : 0
  if (v <= 0) {
    return ''
  }
  if (v < 1024) {
    return v + ' B'
  }
  if (v < 1024 * 1024) {
    return Math.round(v / 102.4) / 10 + ' KB'
  }
  return Math.round(v / (1024 * 102.4)) / 10 + ' MB'
}

function kindLabel(kind) {
  const k = str(kind)
  if (k === 'kdenlive') {
    return 'Kdenlive'
  }
  if (k === 'srt' || k === 'vtt' || k === 'subtitle') {
    return 'Subtitles'
  }
  if (k === 'poster') {
    return 'Poster'
  }
  if (k === 'stats') {
    return 'Stats'
  }
  if (k === 'plan') {
    return 'Plan'
  }
  if (k === 'readme') {
    return 'Notes'
  }
  if (k === 'music') {
    return 'Music'
  }
  return 'File'
}

/** Downloadable project files from the folder index (files.json). Never hardcoded per title. */
function loadProjectFiles(projectPath) {
  let out = []
  const base = str(projectPath)
  if (base.length === 0) {
    return out
  }
  try {
    const raw = fetchText(base + '/files.json')
    if (!raw || raw.length === 0) {
      return out
    }
    const data = JSON.parse(raw)
    const list = data && data.files ? data.files : []
    for (let i = 0; i < list.length; i++) {
      const it = list[i]
      if (!it || !it.path) {
        continue
      }
      const rel = str(it.path)
      if (rel.length === 0) {
        continue
      }
      const lower = rel.toLowerCase()
      const kind = str(it.kind || 'other')
      // Feature media + page chrome already shown elsewhere (Notes / poster).
      if (lower.indexOf('.mkv') === lower.length - 4 && lower.length >= 4) {
        continue
      }
      if (kind === 'readme' || kind === 'poster' || kind === 'manifest') {
        continue
      }
      const baseName = lower.lastIndexOf('/') >= 0 ? lower.slice(lower.lastIndexOf('/') + 1) : lower
      if (baseName === 'files.json' || baseName === 'readme.md') {
        continue
      }
      out = out.concat([
        {
          path: rel,
          kind: kind,
          bytes: typeof it.bytes === 'number' ? it.bytes : 0,
        },
      ])
    }
  } catch (e) {
    out = []
  }
  return out
}

function fileHref(projectPath, relPath) {
  const base = str(projectPath)
  const rel = str(relPath)
  if (base.length === 0 || rel.length === 0) {
    return ''
  }
  return encodeMarkdownUrl(absoluteStreamUrl('/' + base + '/' + rel))
}

function looksLikeCid(raw) {
  const s = str(raw).trim()
  if (s.length < 10) {
    return false
  }
  if (s.indexOf(' ') >= 0 || s.indexOf('/') >= 0 || s.indexOf('#') >= 0) {
    return false
  }
  if (s.indexOf('baf') === 0) {
    return true
  }
  if (s.indexOf('Qm') === 0) {
    return true
  }
  return s.length >= 46
}

function parseCidFromStub(text) {
  const raw = str(text)
  if (raw.length === 0) {
    return ''
  }
  const lines = raw.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = str(lines[i]).trim()
    if (line.length > 0 && looksLikeCid(line)) {
      return line
    }
    i = i + 1
  }
  return ''
}

/** CID from .ipfs stub only — avoid relayAssetStatus self-fetch during SSR (deadlocks). */
function resolveProjectCid(project) {
  if (!project || !project.path) {
    return ''
  }
  const playSrc = pickPlayableSrc(project)
  if (playSrc.length > 0) {
    const logical = playSrc.charAt(0) === '/' ? playSrc.slice(1) : playSrc
    const cid = resolveCidForLogical(logical)
    if (cid.length > 0) {
      return cid
    }
  }
  const master = projectMediaField(project, 'media')
  if (master.length === 0) {
    return ''
  }
  return resolveCidForLogical(str(project.path) + '/' + master)
}

function jsonEscapeStr(s) {
  const raw = str(s)
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charAt(i)
    if (c === '\\') {
      out = out + '\\\\'
    } else if (c === '"') {
      out = out + '\\"'
    } else if (c === '\n') {
      out = out + '\\n'
    } else if (c === '\r') {
      out = out + '\\r'
    } else if (c === '\t') {
      out = out + '\\t'
    } else {
      out = out + c
    }
  }
  return out
}

/** Prefer prebuilt string from index.json (CleverScript-safe); else build tracks. */
function subtitlesJson(project) {
  try {
    if (project && project.subtitlesJson) {
      const ready = str(project.subtitlesJson)
      if (ready.length > 2) {
        return ready
      }
    }
  } catch (e0) {}
  try {
    const tracks = subtitleTracks(project)
    if (!tracks || tracks.length === 0) {
      return '[]'
    }
    let body = ''
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i]
      if (i > 0) {
        body = body + ','
      }
      let piece =
        '{"src":"' +
        jsonEscapeStr(t.src) +
        '","label":"' +
        jsonEscapeStr(t.label || 'Subtitles') +
        '","lang":"' +
        jsonEscapeStr(t.lang || 'en') +
        '"'
      if (t.default === true) {
        piece = piece + ',"default":true'
      }
      piece = piece + '}'
      body = body + piece
    }
    return '[' + body + ']'
  } catch (e) {
    return '[]'
  }
}

function isNarrowViewport() {
  try {
    if (typeof globalThis === 'undefined') {
      return true
    }
    if (!globalThis.matchMedia) {
      const w = typeof globalThis.innerWidth === 'number' ? globalThis.innerWidth : 0
      return w < 900
    }
    return globalThis.matchMedia('(max-width: 900px)').matches === true
  } catch (e) {
    return true
  }
}

function requestFs(el) {
  try {
    if (!el) {
      return
    }
    if (el.requestFullscreen) {
      el.requestFullscreen()
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen()
    } else if (el.webkitEnterFullscreen) {
      el.webkitEnterFullscreen()
    }
  } catch (e) {}
}

function routeKind(route) {
  if (route === '/' || route === '') {
    return { kind: 'home' }
  }
  if (route === '/legal') {
    return { kind: 'md', file: 'content/legal.md', title: 'Ownership policy' }
  }
  if (route === '/terms') {
    return { kind: 'md', file: 'content/terms.md', title: 'Terms' }
  }
  if (route === '/motivation' || route === '/why') {
    return { kind: 'md', file: 'content/motivation.md', title: 'Why we’re doing this' }
  }
  if (route === '/submit' || route === '/contribute') {
    return { kind: 'md', file: 'content/submit.md', title: 'Submissions' }
  }
  if (route === '/setup' || route === '/playback' || route === '/vlc') {
    return { kind: 'md', file: 'content/setup.md', title: 'Setup for playback' }
  }
  if (route === '/app' || route === '/android' || route === '/apk') {
    return { kind: 'app', file: 'content/app.md', title: 'Flashback App' }
  }
  if (route === '/android-lab') {
    return { kind: 'md', file: 'content/android-lab.md', title: 'Android APK lab' }
  }
  if (route === '/request' || route === '/downloads' || route === '/email') {
    return { kind: 'request', file: 'content/request.md', title: 'Request downloads' }
  }
  if (route === '/board' || route === '/feedback' || route === '/bugs') {
    return { kind: 'board' }
  }
  if (route === '/chat') {
    return { kind: 'chat' }
  }
  let slug = route
  if (slug.charAt(0) === '/') {
    slug = slug.slice(1)
  }
  if (slug.indexOf('movie/') === 0) {
    slug = slug.slice('movie/'.length)
  }
  if (slug.indexOf('/') >= 0) {
    return { kind: 'home' }
  }
  return { kind: 'movie', slug: slug }
}

function navigate(path) {
  const p = normalizeRoute(path)
  try {
    if (typeof globalThis !== 'undefined' && globalThis.location) {
      globalThis.location.href = p
      return
    }
  } catch (e) {}
}

/** IRC channel key for page embeds (`movie-<slug>` / `page-<name>`). */
function chatChannelForRoute(kind, route) {
  try {
    if (kind && kind.kind === 'movie' && kind.slug) {
      return 'movie-' + str(kind.slug)
    }
    if (kind && kind.kind === 'home') {
      return 'page-home'
    }
    if (kind && kind.kind === 'board') {
      return 'page-board'
    }
    if (kind && kind.kind === 'chat') {
      return 'flashback'
    }
    if (kind && kind.kind === 'app') {
      return 'page-app'
    }
    if (kind && kind.kind === 'request') {
      return 'page-request'
    }
    if (kind && kind.kind === 'md' && kind.file) {
      const f = str(kind.file)
      if (f.indexOf('setup') >= 0) {
        return 'page-setup'
      }
      if (f.indexOf('legal') >= 0) {
        return 'page-legal'
      }
      if (f.indexOf('terms') >= 0) {
        return 'page-terms'
      }
      if (f.indexOf('motivation') >= 0) {
        return 'page-motivation'
      }
      if (f.indexOf('submit') >= 0) {
        return 'page-submit'
      }
      if (f.indexOf('android-lab') >= 0) {
        return 'page-android-lab'
      }
    }
  } catch (eCh) {}
  let p = str(route || '/')
  if (p === '/' || p === '') {
    return 'page-home'
  }
  if (p.charAt(0) === '/') {
    p = p.slice(1)
  }
  // CleverScript-safe slugify (no regex literals)
  let out = ''
  const lower = p.toLowerCase()
  for (let i = 0; i < lower.length; i++) {
    const ch = lower.charAt(i)
    const code = lower.charCodeAt(i)
    const ok =
      (code >= 48 && code <= 57) ||
      (code >= 97 && code <= 122) ||
      ch === '_' ||
      ch === '-'
    out = out + (ok ? ch : '-')
  }
  if (!out) {
    return 'page-home'
  }
  return 'page-' + out
}

function stripLeadingHash(s) {
  let t = str(s)
  while (t.length > 0 && t.charAt(0) === '#') {
    t = t.slice(1)
  }
  return t
}

function chatChannelFromLocation(fallback) {
  try {
    const loc = typeof globalThis !== 'undefined' ? globalThis.location : null
    if (loc && loc.search) {
      const q = str(loc.search)
      // CleverScript-safe: avoid URLSearchParams / regex / String()
      let c = ''
      const parts = q.charAt(0) === '?' ? q.slice(1).split('&') : q.split('&')
      for (let i = 0; i < parts.length; i++) {
        const kv = parts[i].split('=')
        if (kv[0] === 'c' || kv[0] === 'channel') {
          c = decodeURIComponent(kv.slice(1).join('=') || '')
          break
        }
      }
      if (c) {
        return stripLeadingHash(c)
      }
    }
    if (loc && loc.hash && str(loc.hash).length > 1) {
      return stripLeadingHash(str(loc.hash))
    }
  } catch (eLoc) {}
  return fallback || 'flashback'
}

function projectSlug(p) {
  try {
    if (p && p.slug) {
      return str(p.slug)
    }
  } catch (e) {}
  return ''
}

/** Brief stats line from index.json fields (stats.json → generate-index-json). */
function projectStatsLine(p) {
  let parts = []
  try {
    const cut = projectMediaField(p, 'timeCut')
    const edit = projectMediaField(p, 'faneditRuntime')
    const avail = projectMediaField(p, 'availableIn')
    if (edit.length > 0) {
      parts = parts.concat(['edit ' + edit])
    }
    if (cut.length > 0) {
      parts = parts.concat(['cut ' + cut])
    }
    if (avail.length > 0) {
      parts = parts.concat([avail])
    }
  } catch (eStats) {}
  if (parts.length === 0) {
    return ''
  }
  return parts.join(' · ')
}

/**
 * First bullets under ## What changed / ## Changes in project README.
 * CleverScript-safe (no regex literals).
 */
function projectChangesBrief(p) {
  try {
    let path = ''
    try {
      if (p && p.path) {
        path = str(p.path)
      }
    } catch (ePath) {
      path = ''
    }
    if (path.length === 0) {
      return ''
    }
    let readme = ''
    try {
      readme = fetchText(path + '/README.md')
    } catch (eFetch) {
      readme = ''
    }
    if (!readme || readme.length === 0) {
      return ''
    }
    const lines = str(readme).split('\n')
    let inSection = false
    let bullets = []
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      let s = ''
      try {
        s = str(raw).trim()
      } catch (eTrim) {
        s = ''
      }
      if (s.indexOf('## ') === 0) {
        const head = s.slice(3).toLowerCase()
        if (inSection) {
          break
        }
        if (
          head.indexOf('what changed') >= 0 ||
          head === 'changes' ||
          head.indexOf('cut list') >= 0
        ) {
          inSection = true
        }
        continue
      }
      if (!inSection) {
        continue
      }
      if (s.indexOf('#') === 0) {
        break
      }
      if (s === '---') {
        break
      }
      if (s.indexOf('- ') === 0 || s.indexOf('* ') === 0) {
        bullets = bullets.concat([s])
        if (bullets.length >= 4) {
          break
        }
      }
    }
    if (bullets.length === 0) {
      return ''
    }
    return bullets.join('\n')
  } catch (eBrief) {
    return ''
  }
}

/** Catalog items for park-native NowShowing (lcd + carousel).
 * Prefer index.nowShowing slug order; fall back to status=showing. */
function nowShowingItemsJson(projects, nowShowingSlugs) {
  try {
    return nowShowingItemsJsonInner(projects, nowShowingSlugs)
  } catch (eOuter) {
    return '[]'
  }
}

function nowShowingItemsJsonInner(projects, nowShowingSlugs) {
  let out = []
  let list = []
  let slugs = []
  try {
    if (projects) {
      list = projects
    }
  } catch (e) {
    list = []
  }
  try {
    if (nowShowingSlugs) {
      slugs = nowShowingSlugs
    }
  } catch (eSlugs) {
    slugs = []
  }

  function posterFor(p) {
    // Prefer index.json `image` (repo-relative path like FanMixes/…/poster.jpg).
    // Legacy `poster` is a basename under `path`.
    let poster = ''
    try {
      if (p && p.image) {
        poster = '' + p.image
        if (poster.length > 0 && poster.charAt(0) !== '/') {
          poster = '/' + poster
        }
      } else if (p && p.poster && p.path) {
        poster = '/' + p.path + '/' + p.poster
      }
    } catch (e2) {}
    return poster
  }

  function pushItem(p) {
    let t = projectTitle(p)
    let s = projectSlug(p)
    if (t.length > 0 && s.length > 0) {
      let blurb = ''
      try {
        if (p && p.blurb) {
          blurb = '' + p.blurb
        }
      } catch (eBlurb) {
        blurb = ''
      }
      let stats = ''
      let changes = ''
      let readmeBody = ''
      let projectPath = ''
      try {
        if (p && p.path) {
          projectPath = str(p.path)
        }
      } catch (ePath) {
        projectPath = ''
      }
      try {
        stats = projectStatsLine(p)
      } catch (eStatsLine) {
        stats = ''
      }
      try {
        changes = projectChangesBrief(p)
      } catch (eChanges) {
        changes = ''
      }
      // Full README (minus H1 + lead blurb) for carousel scroll pane.
      if (projectPath.length > 0) {
        try {
          let rawReadme = ''
          try {
            rawReadme = fetchText(projectPath + '/README.md')
          } catch (eFetch) {
            rawReadme = ''
          }
          if (rawReadme && str(rawReadme).length > 0) {
            const hero = parseReadmeHero(rawReadme, t)
            if (blurb.length === 0 && hero.blurb && hero.blurb.length > 0) {
              blurb = hero.blurb
            }
            if (hero.body && hero.body.length > 0) {
              readmeBody = rewriteReadmeAssetLinks(hero.body, projectPath)
            }
          }
        } catch (eReadme) {
          readmeBody = ''
        }
      }
      out = out.concat([
        {
          title: t,
          href: '/' + s,
          poster: posterFor(p),
          blurb: blurb,
          readme: readmeBody,
          stats: stats,
          changes: changes,
        },
      ])
    }
  }

  if (slugs && slugs.length > 0) {
    for (let i = 0; i < slugs.length; i++) {
      let want = ''
      try {
        want = '' + slugs[i]
      } catch (eWant) {
        want = ''
      }
      if (want.length === 0) {
        continue
      }
      for (let j = 0; j < list.length; j++) {
        if (projectSlug(list[j]) === want) {
          pushItem(list[j])
          break
        }
      }
    }
  } else {
    for (let i = 0; i < list.length; i++) {
      let st = ''
      try {
        if (list[i] && list[i].status) {
          st = '' + list[i].status
        }
      } catch (eSt) {}
      if (st === 'showing') {
        pushItem(list[i])
      }
    }
  }
  try {
    return JSON.stringify(out)
  } catch (e3) {
    return '[]'
  }
}

export default function FlashbackApp() {
  ensureOwnershipAckFromBrowser()
  const route = initialRoute()
  const kind = routeKind(route)
  if (kind.kind === 'movie' && kind.slug) {
    ensureMovieOwnAckFromBrowser(kind.slug)
  }

  let projects = []
  let nowShowingSlugs = []
  try {
    const res = fetch('/index.json')
    if (res && res.ok === true && res.text) {
      const data = JSON.parse(res.text)
      if (data && data.projects) {
        projects = data.projects
      }
      try {
        if (data && data.nowShowing) {
          nowShowingSlugs = data.nowShowing
        }
      } catch (eNs) {
        nowShowingSlugs = []
      }
    }
  } catch (e) {
    projects = []
    nowShowingSlugs = []
  }

  let homeMd = ''
  let blogPosts = []
  let md = ''
  let readme = ''
  if (kind.kind === 'home') {
    homeMd = fetchText('content/home.md')
    try {
      const raw = fetchText('content/blog/index.json')
      const data = raw ? JSON.parse(raw) : null
      const list = data && data.posts ? data.posts : []
      for (let i = 0; i < list.length; i++) {
        const meta = list[i]
        if (!meta || !meta.path) {
          continue
        }
        blogPosts = blogPosts.concat([{
          slug: meta.slug || '',
          date: meta.date || '',
          title: meta.title || 'Post',
          body: fetchText(meta.path) || '',
        }])
      }
    } catch (e) {
      blogPosts = []
    }
  }
  if (kind.kind === 'md' || kind.kind === 'request' || kind.kind === 'app') {
    md = fetchText(kind.file)
  }

  let apkMeta = {
    versionName: '',
    versionCode: '',
    apkUrl: '/downloads/flashback.apk',
    apkArm64: '/downloads/flashback-arm64-v8a.apk',
    apkArmv7: '/downloads/flashback-armeabi-v7a.apk',
  }
  if (kind.kind === 'app') {
    try {
      const raw = fetchText('downloads/flashback.json')
      if (raw && raw.length > 0) {
        const j = JSON.parse(raw)
        if (j) {
          if (j.versionName) {
            apkMeta.versionName = str(j.versionName)
          }
          if (j.versionCode !== null && j.versionCode !== undefined) {
            apkMeta.versionCode = str(j.versionCode)
          }
          if (j.apkUrl) {
            const u = str(j.apkUrl)
            if (u.indexOf('/downloads/') >= 0) {
              apkMeta.apkUrl = u.slice(u.indexOf('/downloads/'))
            } else if (u.indexOf('http') !== 0) {
              apkMeta.apkUrl = u.charAt(0) === '/' ? u : '/' + u
            }
          }
          if (j.apkUrls) {
            if (j.apkUrls['arm64-v8a']) {
              const u = str(j.apkUrls['arm64-v8a'])
              if (u.indexOf('/downloads/') >= 0) {
                apkMeta.apkArm64 = u.slice(u.indexOf('/downloads/'))
              }
            }
            if (j.apkUrls['armeabi-v7a']) {
              const u = str(j.apkUrls['armeabi-v7a'])
              if (u.indexOf('/downloads/') >= 0) {
                apkMeta.apkArmv7 = u.slice(u.indexOf('/downloads/'))
              }
            }
          }
        }
      }
    } catch (eApk) {}
  }

  const REQUEST_EMAIL = 'ari@asu.edu'
  const REQUEST_SUBJECT = 'Request: Flashback FanEdit Downloads'
  const REQUEST_BODY = 'Flashback FanEdit Downloads'
  const requestMailto =
    'mailto:ari@asu.edu?subject=Request:%20Flashback%20FanEdit%20Downloads&body=Flashback%20FanEdit%20Downloads'

  const selected = kind.kind === 'movie' ? findProject(projects, kind.slug) : null
  if (kind.kind === 'movie' && selected) {
    readme = fetchText(selected.path + '/README.md')
  }

  const fanMixes = projectsInCategory(projects, 'FanMixes')
  const kidFriendly = projectsInCategory(projects, 'KidFriendly')

  const playingState = useState(false)
  const playing = playingState[0]
  const setPlaying = playingState[1]

  const cmdState = useState(0)
  const command = cmdState[0]
  const setCommand = cmdState[1]

  // Hard-off: TheaterPlayer (HTML5/WASM + mirror hunt) is disabled site-wide.
  // In-browser MKV/HEVC was crashing tabs (notably Van Helsing); use ExternalPlay/VLC only.
  const inPageMkvOk = false

  const seqState = useState(0)
  const commandSeq = seqState[0]
  const setCommandSeq = seqState[1]

  const ackState = useState(hasOwnershipAck())
  const ackStored = ackState[0]
  const setAck = ackState[1]
  const ack = ackStored === true || hasOwnershipAck() === true

  const initialMovieAck =
    kind.kind === 'movie' && kind.slug ? hasMovieOwnAck(kind.slug) === true : false
  const movieAckState = useState(initialMovieAck)
  const movieAckStored = movieAckState[0]
  const setMovieAck = movieAckState[1]
  // Re-read localStorage each render (SSR useState stays false; inject/query may set LS).
  let movieAckFromLs = false
  if (kind.kind === 'movie') {
    if (kind.slug) {
      if (hasMovieOwnAck(kind.slug) === true) {
        movieAckFromLs = true
      }
    }
  }
  const movieAck = movieAckStored === true || movieAckFromLs === true

  // Soft-hydrate: SSR paints locked+overlay first. Phase helpers (isClientLive*) are
  // unreliable on parked embed; defer LS-based unlock until after hydrate settles.
  const pastState = useState(false)
  const pastHydrate = pastState[0]
  const setPastHydrate = pastState[1]
  const schedState = useState(false)
  const hydrateScheduled = schedState[0]
  const setHydrateScheduled = schedState[1]
  if (hydrateScheduled !== true) {
    setHydrateScheduled(true)
    try {
      if (typeof globalThis !== 'undefined' && globalThis.setTimeout) {
        globalThis.setTimeout(() => {
          setPastHydrate(true)
        }, 50)
      }
    } catch (e) {}
  }
  let clientReadyFlag = false
  try {
    if (typeof globalThis !== 'undefined' && globalThis.document && globalThis.document.documentElement) {
      let rootEl = globalThis.document.documentElement
      // Only data-fb-client-ready (set ~150ms post-load by inject). Do NOT use
      // data-pt-hydrated — it is often already "1" on first client paint and
      // unlocking then desyncs SSR locked markup (soft-hydrate freeze).
      if (rootEl.getAttribute('data-fb-client-ready') === '1') {
        clientReadyFlag = true
      }
    }
  } catch (eHydrated) {}
  const live = pastHydrate === true || clientReadyFlag === true
  const mediaUnlocked = live === true && ack === true && movieAck === true
  const showMovieAck = mediaUnlocked !== true

  function mediaVideoEl() {
    try {
      if (typeof globalThis === 'undefined' || !globalThis.document) {
        return null
      }
      const doc = globalThis.document
      if (!doc.querySelector) {
        return null
      }
      return doc.querySelector('.fb-media-unlock-target video.fb-media-video')
    } catch (e) {
      return null
    }
  }

  function sendPlay() {
    if (inPageMkvOk !== true) {
      return
    }
    if (mediaUnlocked !== true) {
      try {
        const host = theaterHostEl()
        if (host) {
          const built = host.querySelector ? host.querySelector('.fb-theater-player') : null
          if (built && built.__fbCtx && built.__fbCtx.setPlaybackError) {
            built.__fbCtx.setPlaybackError(
              'Confirm ownership first — the Affirmation gate must be accepted before Play.',
            )
          }
        }
        const gate = globalThis.document
          ? globalThis.document.querySelector('.fb-affirmation-native, .fb-gate, [aria-modal="true"]')
          : null
        if (gate && gate.scrollIntoView) {
          gate.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } catch (eLocked) {}
      return
    }
    const nextSeq = commandSeq + 1
    setCommand(1)
    setCommandSeq(nextSeq)
    setPlaying(true)
    pushTheaterCommand('true', 1, nextSeq)
    try {
      const host = theaterHostEl()
      if (host) {
        const built = host.querySelector ? host.querySelector('.fb-theater-player') : null
        if (built && built.__fbCtx && built.__fbCtx.notePlayWhileSeeding) {
          built.__fbCtx.notePlayWhileSeeding()
        } else if (built && built.__fbStartMirrorHunt) {
          built.__fbStartMirrorHunt({ fromPlay: true })
        }
      }
    } catch (eHunt) {}
    try {
      const v = mediaVideoEl()
      if (v && v.play) {
        const p = v.play()
        if (p && p.catch) {
          p.catch(() => {})
        }
      }
    } catch (ePlay) {}
    if (isNarrowViewport()) {
      try {
        const doc = typeof globalThis !== 'undefined' ? globalThis.document : null
        if (!doc || !doc.querySelector) {
          return
        }
        const root = doc.querySelector('.fb-media-ready') || doc.querySelector('.fb-video-panel')
        requestFs(root)
      } catch (e) {}
    }
  }

  function sendPause() {
    if (inPageMkvOk !== true) {
      return
    }
    const nextSeq = commandSeq + 1
    setCommand(2)
    setCommandSeq(nextSeq)
    setPlaying(false)
    pushTheaterCommand('false', 2, nextSeq)
    try {
      const v = mediaVideoEl()
      if (v && v.pause) {
        v.pause()
      }
    } catch (ePause) {}
  }

  function titleCard(p) {
    const status = p.status || 'wip'
    let meta = status
    if (status === 'showing') {
      meta = 'now showing'
    } else if (status === 'coming_soon' || status === 'ready') {
      meta = 'coming soon'
    }
    return (
      <a
        key={p.slug}
        className={'fb-title-card fb-status-' + status}
        href={'/' + p.slug}
      >
        <span className="fb-title-card-mark">
          <PlayChevron />
        </span>
        <span className="fb-title-card-body">
          <span className="fb-title-card-name">{p.title}</span>
          {p.blurb ? <span className="fb-title-card-blurb">{p.blurb}</span> : null}
          <span className="fb-title-card-meta">{meta}</span>
        </span>
      </a>
    )
  }

  let fanCards = []
  for (let i = 0; i < fanMixes.length; i++) {
    fanCards = fanCards.concat([titleCard(fanMixes[i])])
  }
  let kidCards = []
  for (let i = 0; i < kidFriendly.length; i++) {
    kidCards = kidCards.concat([titleCard(kidFriendly[i])])
  }
  const nowItemsJson = nowShowingItemsJson(projects, nowShowingSlugs)
  let blogCards = []
  for (let i = 0; i < blogPosts.length; i++) {
    const post = blogPosts[i]
    blogCards = blogCards.concat([
      <article key={post.slug || post.title} className="fb-blog-post">
        {post.date ? <p className="fb-blog-date">{post.date}</p> : null}
        <h3 className="fb-blog-title">{post.title}</h3>
        <div className="fb-blog-body fb-prose">
          <MarkdownRenderer content={post.body || ''} />
        </div>
      </article>
    ])
  }

  const pageChatChannel = chatChannelForRoute(kind, route)

  let main = null
  if (kind.kind === 'chat') {
    const chatCh = chatChannelFromLocation('flashback')
    main = (
      <div className="fb-doc fb-chat-page">
        <a className="fb-back" href="/">
          ← Library
        </a>
        <h1 className="fb-movie-title">Chat</h1>
        <p className="fb-movie-blurb">
          Live lobby and per-page channels. Pick a nick or use a theater seat name. Limited markdown
          and image links welcome.
        </p>
        <ChatApp channel={chatCh} />
      </div>
    )
  } else if (kind.kind === 'board') {
    const bq = boardQueryFromLocation()
    main = (
      <div className="fb-doc">
        <a className="fb-back" href="/">
          ← Library
        </a>
        <h1 className="fb-movie-title">Board</h1>
        <p className="fb-movie-blurb">
          Bugs, comments, and short reviews — public notes on the git comments branch.
        </p>
        <Board path={bq.path} kind={bq.kind} />
      </div>
    )
  } else if (kind.kind === 'app') {
    main = (
      <article className="fb-doc fb-prose">
        <AppDownloads
          versionName={apkMeta.versionName}
          versionCode={apkMeta.versionCode}
          apkUrl={apkMeta.apkUrl}
          apkArm64={apkMeta.apkArm64}
          apkArmv7={apkMeta.apkArmv7}
        />
        <MarkdownRenderer content={md || '# Loading…'} />
      </article>
    )
  } else if (kind.kind === 'md') {
    // Setup: expose #ipfs and #clone-repo (MarkdownRenderer escapes raw HTML anchors).
    let setupBefore = ''
    let setupIpfs = ''
    let setupAfterIpfs = ''
    let setupClone = ''
    let isSetup = false
    try {
      if (kind.file === 'content/setup.md') {
        isSetup = true
        const full = str(md || '')
        const ipfsMarker = '## Open catalog titles over IPFS'
        const afterIpfsMarker = '## If something goes wrong'
        const advancedMarker = '## Advanced (editors only)'
        const ipfsAt = full.indexOf(ipfsMarker)
        const afterIpfsAt = full.indexOf(afterIpfsMarker)
        const advAt = full.indexOf(advancedMarker)
        // Document order: Steps → #ipfs → troubleshooting → #clone-repo (Advanced)
        if (ipfsAt >= 0 && afterIpfsAt > ipfsAt && advAt > afterIpfsAt) {
          setupBefore = full.slice(0, ipfsAt)
          setupIpfs = full.slice(ipfsAt, afterIpfsAt)
          setupAfterIpfs = full.slice(afterIpfsAt, advAt)
          setupClone = full.slice(advAt)
        } else if (ipfsAt >= 0 && advAt > ipfsAt) {
          setupBefore = full.slice(0, ipfsAt)
          setupIpfs = full.slice(ipfsAt, advAt)
          setupAfterIpfs = ''
          setupClone = full.slice(advAt)
        } else if (advAt >= 0) {
          setupBefore = full.slice(0, advAt)
          setupIpfs = ''
          setupAfterIpfs = ''
          setupClone = full.slice(advAt)
        } else if (ipfsAt >= 0) {
          setupBefore = full.slice(0, ipfsAt)
          setupIpfs = full.slice(ipfsAt)
          setupAfterIpfs = ''
          setupClone = ''
        } else {
          setupBefore = full
          setupIpfs = ''
          setupAfterIpfs = ''
          setupClone = ''
        }
      }
    } catch (eSetup) {
      isSetup = false
    }
    if (isSetup === true) {
      main = (
        <article className="fb-doc fb-prose">
          <MarkdownRenderer content={setupBefore || '# Loading…'} />
          {setupIpfs.length > 0 ? (
            <section id="ipfs" aria-label="Open catalog titles over IPFS">
              <MarkdownRenderer content={setupIpfs} />
            </section>
          ) : null}
          {setupAfterIpfs.length > 0 ? <MarkdownRenderer content={setupAfterIpfs} /> : null}
          {setupClone.length > 0 ? (
            <section id="clone-repo" aria-label="Clone the catalog from a Relay server">
              <MarkdownRenderer content={setupClone} />
            </section>
          ) : null}
        </article>
      )
    } else {
      main = (
        <article className="fb-doc fb-prose">
          <MarkdownRenderer content={md || '# Loading…'} />
        </article>
      )
    }
  } else if (kind.kind === 'request') {
    main = (
      <article className="fb-doc fb-prose">
        <MarkdownRenderer content={md || '# Request full-quality downloads'} />
        <form
          className="fb-request-form"
          action={requestMailto}
          method="get"
          onSubmit={(e) => {
            try {
              e.preventDefault()
            } catch (err) {}
            try {
              if (typeof globalThis !== 'undefined' && globalThis.location) {
                globalThis.location.href = requestMailto
              }
            } catch (err2) {}
          }}
        >
          <label className="fb-request-field">
            <span>To</span>
            <input type="text" name="to" value={REQUEST_EMAIL} readOnly />
          </label>
          <label className="fb-request-field">
            <span>Subject</span>
            <input type="text" name="subject" value={REQUEST_SUBJECT} readOnly />
          </label>
          <label className="fb-request-field">
            <span>Body</span>
            <input type="text" name="body" value={REQUEST_BODY} readOnly />
          </label>
          <p className="fb-request-hint">
            Opens your email app. Send as-is — do not change the subject. The auto-reply has every download link.
          </p>
          <button type="submit" className="fb-btn fb-btn-primary fb-request-submit">
            Open email app
          </button>
          <p className="fb-request-fallback">
            Or mail <code>{REQUEST_EMAIL}</code> with subject{' '}
            <code>{REQUEST_SUBJECT}</code>
          </p>
        </form>
      </article>
    )
  } else if (kind.kind === 'movie') {
    const folderName = selected
      ? folderNameFromPath(selected.path)
      : str(kind.slug)
    const hero = parseReadmeHero(readme || '', folderName)
    let displayTitle = folderName
    if (hero.title.length > 0) {
      displayTitle = hero.title
    } else if (selected && selected.title) {
      displayTitle = selected.title
    }
    let displayBlurb = ''
    if (hero.blurb.length > 0) {
      displayBlurb = stripLeadingPosterImage(hero.blurb)
    } else if (selected && selected.blurb) {
      displayBlurb = stripLeadingPosterImage(selected.blurb)
    }
    let startAtVal = ''
    const startAtNum = startAtFromLocation()
    if (startAtNum >= 0) {
      startAtVal = startAtNum
    }
    let streamUrl = ''
    let streamUrlWeb = ''
    let streamUrlMobile = ''
    let disableWeb = false
    let disableMobile = false
    let masterCid = ''
    let downloadName = 'movie.mkv'
    let projectStatus = ''
    if (selected) {
      const onServer = projectIsNowShowing(selected, nowShowingSlugs)
      // Now showing: prefer Bunny streamHttps; tip /FanMixes/… is legacy fallback.
      // Other titles: no streamUrl — ExternalPlay shows clickable ipfs://{cid} (not site gateway).
      if (onServer) {
        const bunnyMaster = projectMediaField(selected, 'streamHttps')
        if (bunnyMaster.length > 0) {
          streamUrl = encodeMarkdownUrl(absoluteStreamUrl(bunnyMaster))
        } else {
          // VLC on macOS rejects MRLs with raw spaces or parentheses.
          streamUrl = encodeMarkdownUrl(absoluteStreamUrl(mediaSrc(selected)))
        }
        const bunnyWeb = projectMediaField(selected, 'streamHttpsWeb')
        const bunnyMobile = projectMediaField(selected, 'streamHttpsMobile')
        // Live 1080p/720p only when Bunny ladder URLs exist — never tip phantoms.
        if (bunnyWeb.length > 0) {
          streamUrlWeb = encodeMarkdownUrl(absoluteStreamUrl(bunnyWeb))
        }
        if (bunnyMobile.length > 0) {
          streamUrlMobile = encodeMarkdownUrl(absoluteStreamUrl(bunnyMobile))
        }
        // Hide 1080p/720p until Bunny ladder uploads exist (ExternalPlay omits empty/disabled).
        disableWeb = bunnyWeb.length === 0
        disableMobile = bunnyMobile.length === 0
        projectStatus = 'showing'
      } else {
        try {
          if (selected.status) {
            projectStatus = str(selected.status)
          }
        } catch (eSt) {}
      }
      masterCid = resolveProjectCid(selected)
      const masterBase = projectMediaField(selected, 'media')
      if (masterBase.length > 0) {
        downloadName = downloadBasename(masterBase)
      } else if (streamUrl.length > 0) {
        downloadName = downloadBasename(streamUrl)
      } else if (masterCid.length >= 8) {
        downloadName = downloadBasename(str(selected.slug) + '.mkv')
      }
    }
    const posterHref = encodeMarkdownUrl(absoluteStreamUrl(projectPosterPath(selected)))
    const readmeMd = stripLeadingPosterImage(
      rewriteReadmeAssetLinks(hero.body || '', selected ? selected.path : ''),
    )
    const hasFeatureMedia =
      selected &&
      (projectMediaField(selected, 'media').length > 0 ||
        projectMediaField(selected, 'mediaWeb').length > 0 ||
        projectMediaField(selected, 'mediaMobile').length > 0 ||
        projectMediaField(selected, 'streamHttps').length > 0)
    let mediaSurface = null
    if (selected) {
      mediaSurface = (
        <div>
          <ExternalPlay
            streamUrl={streamUrl}
            streamUrlWeb={streamUrlWeb}
            streamUrlMobile={streamUrlMobile}
            disableWeb={disableWeb}
            disableMobile={disableMobile}
            cid={masterCid}
            downloadName={downloadName}
            status={projectStatus}
            unlocked={movieAck === true && ack === true}
            setupHref="/setup"
          />
        </div>
      )
    }
    let playDisabled = true
    if (inPageMkvOk === true && movieAck === true && ack === true) {
      playDisabled = false
    }
    let playTitle = 'In-browser Play needs Matroska + HEVC support (not available yet)'
    if (inPageMkvOk === true) {
      playTitle = 'Play in this browser'
    }
    let pauseTitle = 'In-browser Pause needs Matroska + HEVC support (not available yet)'
    if (inPageMkvOk === true) {
      pauseTitle = 'Pause'
    }
    // Hits filled client-side by Hits.host.js (SSR must not fetch /api/hits — self-deadlock).
    const movieHitsEl = kind.slug ? (
      <p
        className="fb-movie-hits"
        data-fb-hits="movie"
        data-fb-hits-path={'/' + kind.slug}
        hidden
      />
    ) : null
    const projectFiles = selected ? loadProjectFiles(selected.path) : []
    let fileRows = []
    for (let fi = 0; fi < projectFiles.length; fi++) {
      const f = projectFiles[fi]
      const href = fileHref(selected.path, f.path)
      const sizeLabel = formatFileBytes(f.bytes)
      fileRows = fileRows.concat([
        <li key={f.path} className="fb-file-row">
          <span className="fb-file-kind">{kindLabel(f.kind)}</span>
          <a className="fb-file-link" href={href}>
            {f.path}
          </a>
          {sizeLabel.length > 0 ? <span className="fb-file-size">{sizeLabel}</span> : null}
        </li>,
      ])
    }
    main = (
      <div className="fb-movie">
        {hasFeatureMedia ? (
          <input id="fb-watch-open" className="fb-watch-toggle" type="checkbox" />
        ) : null}
        <a className="fb-back" href="/">
          ← Library
        </a>
        <h1 className="fb-movie-title">{displayTitle}</h1>
        {movieHitsEl}
        <section className="fb-movie-hero" aria-label="Watch">
          <div className="fb-movie-art">
            <div className="fb-poster-stack">
              {posterHref.length > 0 ? (
                <img
                  src={posterHref}
                  alt=""
                  className="fb-movie-poster"
                  data-fb-pop-image="1"
                  aria-label={'View poster for ' + displayTitle}
                  decoding="async"
                />
              ) : null}
              {hasFeatureMedia ? (
                <label htmlFor="fb-watch-open" className="fb-btn fb-btn-primary fb-watch-cta">
                  Watch
                </label>
              ) : (
                <p className="fb-movie-nomedia">
                  Feature media is not catalogued for streaming yet. Project files are still listed
                  below when present.
                </p>
              )}
            </div>
          </div>
          <div className="fb-movie-notes">
            {displayBlurb.length > 0 ? (
              <div className="fb-movie-blurb fb-prose">
                <MarkdownRenderer content={displayBlurb} />
              </div>
            ) : null}
            {readmeMd.length > 0 ? (
              <div className="fb-readme fb-prose">
                <MarkdownRenderer content={readmeMd} />
              </div>
            ) : null}
          </div>
        </section>
        {selected ? (
          <Affirmation
            mode="title"
            eyebrow="CONFIRM"
            title={'I confirm I own a legal copy of ' + projectOriginalTitle(selected)}
            body={
              'Same house rule fanedit communities have used for years: the edit is for people who already have the movie.\n\nFeature video is on IPFS (not in public git repos); this site only unlocks stream access after you confirm ownership. Not a pirate archive.'
            }
            checkboxLabel={
              'I confirm I own a legal copy of ' +
              projectOriginalTitle(selected) +
              ' before I play its edit.'
            }
            confirmLabel="OK — I confirm"
            storageKey={movieStorageKey(selected.slug)}
            confirmed={movieAck === true}
            linksJson='[{"label":"Ownership policy","href":"/legal"},{"label":"Terms","href":"/terms"}]'
            onConfirm={() => {
              setMovieAck(true)
              setAck(true)
            }}
          />
        ) : null}
        {hasFeatureMedia ? (
          <div className="fb-watch-scrim">
            <label htmlFor="fb-watch-open" className="fb-watch-backdrop" aria-label="Close" />
            <div
              className="fb-watch-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Ways to watch this movie"
            >
              <label htmlFor="fb-watch-open" className="fb-btn fb-watch-close">
                Close
              </label>
              <div className="fb-video-panel">{mediaSurface}</div>
              {inPageMkvOk === true ? (
                <div className="fb-video-controls">
                  <button
                    type="button"
                    className="fb-btn fb-btn-inpage-play"
                    disabled={playDisabled}
                    title={playTitle}
                    onClick={sendPlay}
                  >
                    <PlayChevron className="fb-btn-icon" /> Play
                  </button>
                  <button
                    type="button"
                    className="fb-btn fb-btn-inpage-pause"
                    disabled={playDisabled}
                    title={pauseTitle}
                    onClick={sendPause}
                  >
                    Pause
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="fb-movie-chat">
          <LiveChat
            prefix="fb"
            channel={pageChatChannel}
            path={route || '/'}
            mode="embed"
          />
        </div>
        <section className="fb-movie-files" aria-label="Project files">
          <h2 className="fb-section-title">Project files</h2>
          <p className="fb-files-lead">
            {
              'Subtitles and small project files for this title. Feature video unlocks above after ownership confirm. To clone the catalog or rebuild a cut, see '
            }
            <a className="fb-link" href="/setup">
              {'Setup'}
            </a>
            {' and '}
            <a className="fb-link" href="/submit">
              {'Submit'}
            </a>
            .
          </p>
          {fileRows.length > 0 ? (
            <ul className="fb-file-list">{fileRows}</ul>
          ) : (
            <p className="fb-files-empty">
              No project files are published for this title yet. See{' '}
              <a className="fb-link" href="/setup">
                Setup
              </a>{' '}
              or{' '}
              <a className="fb-link" href="/submit">
                Submit
              </a>{' '}
              once they land.
            </p>
          )}
        </section>
      </div>
    )
  } else {
    main = (
      <div className="fb-home">
        <NowShowing variant="carousel" itemsJson={nowItemsJson} ariaLabel="Now showing" />
        <div className="fb-home-lead">
          <div className="fb-home-intro fb-prose">
            <MarkdownRenderer content={homeMd || '# Welcome'} />
          </div>
          <aside className="fb-home-blog" aria-label="Blog">
            <h2 className="fb-section-title">Blog</h2>
            {blogPosts.length === 0 ? (
              <p className="fb-blog-empty">No posts yet.</p>
            ) : (
              blogCards
            )}
          </aside>
        </div>
        <section className="fb-catalog">
          <h2 className="fb-section-title">FanMixes</h2>
          <div className="fb-title-grid">{fanCards}</div>
          <h2 className="fb-section-title">KidFriendly</h2>
          <div className="fb-title-grid">{kidCards}</div>
        </section>
      </div>
    )
  }

  const footerHitsEl = (
    <span className="fb-footer-hits" data-fb-hits="site" hidden />
  )

  let mainClass = 'fb-main'
  if (kind.kind === 'chat') {
    mainClass = 'fb-main fb-main-chat'
  } else if (kind.kind === 'movie') {
    mainClass = 'fb-main fb-main-movie'
  }

  return (
    <StyleContext src="hooks/client/theme.yaml">
      <div className="fb-app">
        <style>
          {[
            '@keyframes fb-glow-pulse{0%,100%{opacity:0.55}50%{opacity:0.95}}',
            '@media (prefers-reduced-motion:no-preference){.fb-screen-glow{animation:fb-glow-pulse 5.5s ease-in-out infinite}}',
            '@media (prefers-reduced-motion:reduce){.fb-screen-glow{animation:none!important}}',
            /* Backdrop covers live in theater-bg.css (velvet default + classic alt). */
            '.fb-watch-scrim{display:none}.fb-watch-toggle:checked ~ .fb-watch-scrim{display:flex}',
            '@media (max-width:640px){.fb-movie-hero{display:flex;flex-direction:column;height:auto;min-height:0}.fb-movie-art{width:100%;max-width:320px}.fb-movie-poster{width:100%;height:auto;max-height:70vh;flex:0 0 auto}.fb-watch-cta{flex:0 0 auto;min-height:48px}.fb-movie-notes{max-height:50vh;height:auto}.fb-gate,.fb-affirmation-native{align-items:stretch;justify-content:flex-start;padding:0;overflow:auto}.fb-gate-panel,.fb-gate-card{max-width:none;width:100%;min-height:100%;border-radius:0;box-shadow:none;box-sizing:border-box;padding:max(20px,env(safe-area-inset-top)) 18px max(24px,env(safe-area-inset-bottom))}}',
          ].join('')}
        </style>
        <div className={playing === true ? 'fb-backdrop fb-backdrop-playing' : 'fb-backdrop'} aria-hidden="true">
          <div className="fb-wall-lights fb-wall-lights-left" />
          <div className="fb-wall-lights fb-wall-lights-right" />
          <div className="fb-screen-glow" />
        </div>
        {kind.kind !== 'movie' ? (
          <Affirmation
            mode="welcome"
            eyebrow="WELCOME"
            title="Own the original — then enjoy the edit"
            body={
              'Before you play any fan edit here, please confirm you own a legal commercial copy of the corresponding original film. Same house rule fanedit communities have used for years: the edit is for people who already have the movie.\n\nCopyrighted feature files are not stored in the public repos — they are on the IPFS network (servers may cache temporarily for streaming). Access here follows this ownership disclaimer. Not a pirate archive, and not a substitute for buying or renting the studio release.'
            }
            checkboxLabel="I confirm I own a legal copy of each original film before I play its edit."
            confirmLabel="OK — I confirm"
            storageKey={welcomeStorageKey()}
            confirmed={ack === true}
            linksJson='[{"label":"Ownership policy","href":"/legal"},{"label":"Terms","href":"/terms"}]'
            onConfirm={() => {
              setAck(true)
            }}
          />
        ) : null}
        <header className="fb-header">
          <a className="fb-brand" href="/" aria-label="Flashback Repository">
            <img
              className="fb-brand-logo"
              src="/hooks/client/brand/png/logo-header.png"
              alt=""
              width="1024"
              height="130"
            />
          </a>
          <nav className="fb-nav">
            <a className="fb-link" href="/">
              Library
            </a>
            <a className="fb-link" href="/app">
              App
            </a>
            <a className="fb-link" href="/setup">
              Setup
            </a>
            <a className="fb-link" href="/request">
              Request
            </a>
            <a className="fb-link" href="/motivation">
              Why
            </a>
            <a className="fb-link" href="/submit">
              Submit
            </a>
            <a className="fb-link" href="/board">
              Board
            </a>
            <a className="fb-link" href="/chat">
              Chat
            </a>
            <a className="fb-link" href="/legal">
              Legal
            </a>
            <a
              className="fb-link fb-theme-toggle"
              href="#theme"
              data-fb-theater-theme-toggle="1"
            >
              Theme: Velvet
            </a>
            <span className="fb-lobby">
              <label className="fb-lobby-field">
                Music
                <select
                  className="fb-lobby-playlist"
                  data-fb-lobby-playlist="1"
                  aria-label="Lobby playlist"
                >
                  <option value="off" selected>Off</option>
                  <option value="auto">Auto</option>
                  <option value="allYear">All year</option>
                  <option value="winter">Winter</option>
                </select>
              </label>
              <label className="fb-lobby-field">
                Vol
                <input
                  className="fb-lobby-volume"
                  data-fb-lobby-volume="1"
                  type="range"
                  min="0"
                  max="100"
                  value="25"
                  aria-label="Lobby volume"
                />
              </label>
            </span>
          </nav>
        </header>
        <NowShowing variant="lcd" itemsJson={nowItemsJson} ariaLabel="Now showing titles" />
        <main className={mainClass}>
          {main}
          {kind.kind !== 'chat' && kind.kind !== 'movie' ? (
            <LiveChat
              prefix="fb"
              channel={pageChatChannel}
              path={route || '/'}
              mode="embed"
            />
          ) : null}
        </main>
        <footer className="fb-footer">
          <span className="fb-footer-brand">
            <img
              className="fb-brand-mark"
              src="/hooks/client/brand/png/icon-192.png"
              alt=""
              width="28"
              height="28"
            />
            Flashback Repository
          </span>
          <span className="fb-footer-links">
            <a className="fb-link" href="/app">
              {'App'}
            </a>
            {' · '}
            <a className="fb-link" href="/setup">
              {'Setup / VLC'}
            </a>
            {' · '}
            <a className="fb-link" href="/request">
              {'Request downloads'}
            </a>
            {' · '}
            <a className="fb-link" href="/motivation">
              {"Why we're doing this"}
            </a>
            {' · '}
            <a className="fb-link" href="/submit">
              {'Submissions'}
            </a>
            {' · '}
            <a className="fb-link" href="/board">
              {'Board / Report a problem'}
            </a>
            {' · '}
            <a className="fb-link" href="/chat">
              {'Chat'}
            </a>
            {' · '}
            <a className="fb-link" href="/legal">
              {'Ownership'}
            </a>
            {' · '}
            <a className="fb-link" href="/terms">
              {'Terms'}
            </a>
          </span>
          {footerHitsEl}
        </footer>
      </div>
    </StyleContext>
  )
}
