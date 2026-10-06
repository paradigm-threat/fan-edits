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
import TheaterPlayer from 'hooks/client/native/TheaterPlayer.js'
import ExternalPlay from 'hooks/client/native/ExternalPlay.js'
import Board from 'hooks/client/native/Board.js'

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

/** mediaRoot from assets.manifest.json (UnixFS DAG of all thin assets). */
function resolveMediaRootCid() {
  const raw = fetchText('assets.manifest.json')
  if (!raw || raw.length === 0) {
    return ''
  }
  try {
    const data = JSON.parse(raw)
    if (data && typeof data.mediaRoot === 'string') {
      const c = str(data.mediaRoot).trim()
      if (looksLikeCid(c)) {
        return c
      }
    }
  } catch (e) {}
  const tip = fetchText('IPFS_ROOT')
  const tipLines = str(tip).split('\n')
  let line = ''
  if (tipLines.length > 0) {
    line = str(tipLines[0])
  }
  if (looksLikeCid(line)) {
    return line
  }
  return ''
}

function copyCidText(cid) {
  const t = str(cid)
  if (t.length === 0) {
    return
  }
  try {
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.navigator &&
      globalThis.navigator.clipboard &&
      globalThis.navigator.clipboard.writeText
    ) {
      globalThis.navigator.clipboard.writeText(t)
      return
    }
  } catch (e) {}
  try {
    if (typeof globalThis === 'undefined' || !globalThis.document) {
      return
    }
    const doc = globalThis.document
    const el = doc.createElement('textarea')
    el.value = t
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    doc.body.appendChild(el)
    el.select()
    if (doc.execCommand) {
      doc.execCommand('copy')
    }
    doc.body.removeChild(el)
  } catch (e2) {}
}

function encodeCidForUrl(cid) {
  // CIDs are URL-safe as-is.
  return str(cid).trim()
}

/** SSR-safe inspect row — lives in get.jsx so soft-hydrate always paints it. */
function renderIpfsInspect(cidRaw) {
  const cid = str(cidRaw).trim()
  if (!looksLikeCid(cid)) {
    return null
  }
  const enc = encodeCidForUrl(cid)
  return (
    <div className="fb-media-inspect" data-ipfs-inspect="1">
      <p className="fb-media-inspect-label">Inspect on IPFS</p>
      <div className="fb-media-inspect-cid-row">
        <code className="fb-media-inspect-cid" title="Content identifier">
          {cid}
        </code>
        <button
          type="button"
          className="fb-btn fb-media-inspect-copy"
          onClick={() => {
            copyCidText(cid)
          }}
        >
          Copy CID
        </button>
      </div>
      <div className="fb-media-inspect-links">
        <a href={'https://cid.ipfs.tech/#' + cid} target="_blank" rel="noopener noreferrer">
          CID Inspector
        </a>
        <a href={'https://check.ipfs.network/?cid=' + enc} target="_blank" rel="noopener noreferrer">
          Providers
        </a>
      </div>
      <p className="fb-media-inspect-note">
        Playback is same-origin only. The server pins this CID into local IPFS; public gateways are not used for video.
      </p>
    </div>
  )
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
  if (route === '/request' || route === '/downloads' || route === '/email') {
    return { kind: 'request', file: 'content/request.md', title: 'Request downloads' }
  }
  if (route === '/board' || route === '/feedback' || route === '/bugs') {
    return { kind: 'board' }
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

function SeatRows() {
  return (
    <div className="fb-seats" aria-hidden="true">
      <div className="fb-seat-row fb-seat-row-1" />
      <div className="fb-seat-row fb-seat-row-2" />
      <div className="fb-seat-row fb-seat-row-3" />
    </div>
  )
}

function projectSlug(p) {
  try {
    if (p && p.slug) {
      return str(p.slug)
    }
  } catch (e) {}
  return ''
}

/** Catalog items for park-native NowShowing (lcd + carousel).
 * Prefer index.nowShowing slug order; fall back to status=showing. */
function nowShowingItemsJson(projects, nowShowingSlugs) {
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
    let poster = ''
    try {
      if (p && p.poster) {
        poster = '/' + p.path + '/' + p.poster
      } else if (p && p.image) {
        poster = '/' + p.path + '/' + p.image
      }
    } catch (e2) {}
    return poster
  }

  function pushItem(p) {
    let t = projectTitle(p)
    let s = projectSlug(p)
    if (t.length > 0 && s.length > 0) {
      out = out.concat([{ title: t, href: '/' + s, poster: posterFor(p) }])
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
  if (kind.kind === 'md' || kind.kind === 'request') {
    md = fetchText(kind.file)
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

  const inPageMkvOk = canPlayMkvHevc() === true

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

  let main = null
  if (kind.kind === 'board') {
    const bq = boardQueryFromLocation()
    main = (
      <div className="fb-doc">
        <button type="button" className="fb-back" onClick={() => { navigate('/') }}>
          ← Library
        </button>
        <h1 className="fb-movie-title">Board</h1>
        <p className="fb-movie-blurb">
          Bugs, comments, and short reviews — public notes on the git comments branch.
        </p>
        <Board path={bq.path} kind={bq.kind} />
      </div>
    )
  } else if (kind.kind === 'md') {
    main = (
      <article className="fb-doc fb-prose">
        <MarkdownRenderer content={md || '# Loading…'} />
      </article>
    )
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
    const movieCid = selected && selected.media ? resolveProjectCid(selected) : ''
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
      displayBlurb = hero.blurb
    } else if (selected && selected.blurb) {
      displayBlurb = selected.blurb
    }
    let startAtVal = ''
    const startAtNum = startAtFromLocation()
    if (startAtNum >= 0) {
      startAtVal = startAtNum
    }
    let streamUrl = ''
    if (selected) {
      streamUrl = absoluteStreamUrl(mediaSrc(selected))
    }
    let mediaSurface = null
    if (selected && inPageMkvOk === true) {
      mediaSurface = (
        <TheaterPlayer
          src={pickPlayableSrc(selected)}
          srcWeb={mediaSrcFor(selected, projectMediaField(selected, 'mediaWeb'))}
          srcMobile={mediaSrcFor(selected, projectMediaField(selected, 'mediaMobile'))}
          srcMaster={mediaSrc(selected)}
          subtitlesJson={subtitlesJson(selected)}
          cid={movieCid}
          seedState="pending"
          unlocked={movieAck === true && ack === true}
          playing={playing === true}
          command={command}
          commandSeq={commandSeq}
          commandArg=""
          startAt={startAtVal}
        />
      )
    } else if (selected) {
      mediaSurface = (
        <ExternalPlay
          streamUrl={streamUrl}
          unlocked={movieAck === true && ack === true}
          setupHref="/setup"
        />
      )
    }
    let playDisabled = true
    if (inPageMkvOk === true) {
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
    main = (
      <div className="fb-movie">
        <button type="button" className="fb-back" onClick={() => { navigate('/') }}>
          ← Library
        </button>
        <h1 className="fb-movie-title">{displayTitle}</h1>
        {displayBlurb.length > 0 ? (
          <div className="fb-movie-blurb fb-prose">
            <MarkdownRenderer content={displayBlurb} />
          </div>
        ) : null}
        {/* README MD before video in tree order so SSR finishes links/lists; CSS order keeps it below the player. */}
        <div className="fb-readme fb-prose">
          <MarkdownRenderer content={hero.body || ''} />
        </div>
        {selected &&
        (projectMediaField(selected, 'media').length > 0 ||
          projectMediaField(selected, 'mediaWeb').length > 0 ||
          projectMediaField(selected, 'mediaMobile').length > 0) ? (
          <div className="fb-video-panel">
            {mediaSurface}
            <Affirmation
              mode="title"
              eyebrow="CONFIRM"
              title={'I confirm I own a legal copy of ' + projectOriginalTitle(selected)}
              body={
                'Same house rule fanedit communities have used for years: the edit is for people who already have the movie.\n\nThis site is a personal catalog of projects — not a pirate archive.'
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
          </div>
        ) : (
          <p className="fb-movie-nomedia">Feature media is not catalogued yet for this title.</p>
        )}
      </div>
    )
  } else {
    main = (
      <div className="fb-home">
        <NowShowing variant="carousel" itemsJson={nowShowingItemsJson(projects, nowShowingSlugs)} ariaLabel="Now showing" />
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

  const mediaRootCid = resolveMediaRootCid()

  return (
    <StyleContext src="hooks/client/theme.yaml">
      <div className="fb-app">
        <style>
          {'@keyframes fb-glow-pulse{0%,100%{opacity:0.55}50%{opacity:0.95}}@keyframes fb-bulb{0%,100%{opacity:0.4}50%{opacity:1}}@keyframes fb-sconce-breathe{0%,100%{opacity:0.5}50%{opacity:0.78}}@media (prefers-reduced-motion:no-preference){.fb-screen-glow{animation:fb-glow-pulse 5.5s ease-in-out infinite}.fb-bulb-0{animation:fb-bulb 2.2s ease-in-out infinite}.fb-bulb-1{animation:fb-bulb 2.2s ease-in-out 0.4s infinite}.fb-bulb-2{animation:fb-bulb 2.2s ease-in-out 0.8s infinite}.fb-bulb-3{animation:fb-bulb 2.2s ease-in-out 1.2s infinite}.fb-sconce-1{animation:fb-sconce-breathe 7.5s ease-in-out infinite}.fb-sconce-2{animation:fb-sconce-breathe 7.5s ease-in-out 1.6s infinite}.fb-sconce-3{animation:fb-sconce-breathe 7.5s ease-in-out 3.2s infinite}}@media (prefers-reduced-motion:reduce){.fb-screen-glow,.fb-bulb,.fb-sconce{animation:none!important}}'}
        </style>
        <div className={playing === true ? 'fb-backdrop fb-backdrop-playing' : 'fb-backdrop'} aria-hidden="true">
          <div className="fb-curtain fb-curtain-left" />
          <div className="fb-curtain fb-curtain-right" />
          <div className="fb-wall-lights fb-wall-lights-left">
            <span className="fb-sconce fb-sconce-1" />
            <span className="fb-sconce fb-sconce-2" />
            <span className="fb-sconce fb-sconce-3" />
          </div>
          <div className="fb-wall-lights fb-wall-lights-right">
            <span className="fb-sconce fb-sconce-1" />
            <span className="fb-sconce fb-sconce-2" />
            <span className="fb-sconce fb-sconce-3" />
          </div>
          <div className="fb-screen-glow" />
          <SeatRows />
        </div>
        {kind.kind !== 'movie' ? (
          <Affirmation
            mode="welcome"
            eyebrow="WELCOME"
            title="Own the original — then enjoy the edit"
            body={
              'Before you play any fan edit here, please confirm you own a legal commercial copy of the corresponding original film. Same house rule fanedit communities have used for years: the edit is for people who already have the movie.\n\nThis site is a personal catalog of projects — not a pirate archive, and not a substitute for buying or renting the studio release.'
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
          <a className="fb-brand" href="/" aria-label="Flashback Repository" onClick={(e) => {
            try { e.preventDefault() } catch (err) {}
            navigate('/')
          }}>
            <img
              className="fb-brand-logo"
              src="/hooks/client/brand/png/logo-header.png"
              alt=""
              width="160"
              height="63"
            />
            <span className="fb-brand-text">
              <span className="fb-brand-name">Flashback Repository</span>
              <span className="fb-brand-tag">Own the original. Then improve it.</span>
            </span>
          </a>
          <nav className="fb-nav">
            <a href="/" onClick={(e) => { try { e.preventDefault() } catch (err) {} navigate('/') }}>Library</a>
            <a href="/setup" onClick={(e) => { try { e.preventDefault() } catch (err) {} navigate('/setup') }}>Setup</a>
            <a href="/request" onClick={(e) => { try { e.preventDefault() } catch (err) {} navigate('/request') }}>Request</a>
            <a href="/motivation" onClick={(e) => { try { e.preventDefault() } catch (err) {} navigate('/motivation') }}>Why</a>
            <a href="/submit" onClick={(e) => { try { e.preventDefault() } catch (err) {} navigate('/submit') }}>Submit</a>
            <a href="/board" onClick={(e) => { try { e.preventDefault() } catch (err) {} navigate('/board') }}>Board</a>
            <a href="/legal" onClick={(e) => { try { e.preventDefault() } catch (err) {} navigate('/legal') }}>Legal</a>
          </nav>
        </header>
        <NowShowing variant="lcd" itemsJson={nowShowingItemsJson(projects, nowShowingSlugs)} ariaLabel="Now showing titles" />
        <main className="fb-main">{main}</main>
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
            <a href="/setup">Setup / VLC</a>
            {' · '}
            <a href="/request">Request downloads</a>
            {' · '}
            <a href="/motivation">Why we’re doing this</a>
            {' · '}
            <a href="/submit">Submissions</a>
            {' · '}
            <a href="/board">{'Board / Report a problem'}</a>
            {' · '}
            <a href="/legal">Ownership</a>
            {' · '}
            <a href="/terms">Terms</a>
          </span>
          {looksLikeCid(mediaRootCid) ? (
              <div className="fb-footer-ipfs">
                <span className="fb-footer-ipfs-label">Media root (IPFS)</span>
                <code className="fb-footer-ipfs-cid" title="UnixFS DAG of all thin media">
                  {mediaRootCid}
                </code>
                <button
                  type="button"
                  className="fb-btn fb-footer-ipfs-copy"
                  onClick={() => {
                    copyCidText(mediaRootCid)
                  }}
                >
                  Copy
                </button>
                <a
                  href={'https://cid.ipfs.tech/#' + mediaRootCid}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Inspect
                </a>
              </div>
            ) : null}
        </footer>
      </div>
    </StyleContext>
  )
}
