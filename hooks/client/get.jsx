/**
 * Flashback Repository — theater shell (SSR + hydrate).
 */
import React, { useState } from 'react'
import StyleContext from '@clevertree/style'
import { MarkdownRenderer } from '@clevertree/markdown'
import manifest from '@hooks'
import { TicketIcon, PlayChevron, MarqueeBulb } from 'hooks/client/components/Icons.jsx'
import OwnershipGate, { hasOwnershipAck, ensureOwnershipAckFromBrowser } from 'hooks/client/components/OwnershipGate.jsx'
import MovieOwnAck, { hasMovieOwnAck, ensureMovieOwnAckFromBrowser } from 'hooks/client/components/MovieOwnAck.jsx'
import RecentSlideshow from 'hooks/client/components/RecentSlideshow.jsx'

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
    // Encode each path segment so spaces/parens in FanMix folders resolve under SSR fetch.
    const parts = p.split('/')
    let encoded = []
    for (let i = 0; i < parts.length; i++) {
      let seg = parts[i]
      try {
        if (typeof globalThis !== 'undefined' && globalThis.encodeURIComponent) {
          seg = globalThis.encodeURIComponent(seg)
        }
      } catch (eEnc) {}
      encoded = encoded.concat([seg])
    }
    const res = fetch('/' + encoded.join('/'))
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
  if (!project || !project.media || !project.path) {
    return ''
  }
  const logical = str(project.path) + '/' + str(project.media)
  const stub = fetchText('.relay/assets/' + logical + '.ipfs')
  return parseCidFromStub(stub)
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
  const c = str(cid).trim()
  try {
    if (typeof globalThis !== 'undefined' && globalThis.encodeURIComponent) {
      return globalThis.encodeURIComponent(c)
    }
  } catch (e) {}
  return c
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
        <a href={'https://ipfs.io/ipfs/' + enc} target="_blank" rel="noopener noreferrer">
          ipfs.io
        </a>
        <a href={'https://dweb.link/ipfs/' + enc} target="_blank" rel="noopener noreferrer">
          dweb.link
        </a>
      </div>
      <p className="fb-media-inspect-note">
        Open a link to inspect the hash. Public gateway fetches from this page are often CORS-blocked.
      </p>
    </div>
  )
}

/** Drop leading H1 — the movie page already shows the title. */
function readmeBody(raw) {
  const text = str(raw)
  if (!text) {
    return ''
  }
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') {
    i++
  }
  if (i < lines.length && lines[i].indexOf('# ') === 0) {
    i++
    while (i < lines.length && lines[i].trim() === '') {
      i++
    }
  }
  return lines.slice(i).join('\n')
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

function MarqueeLights() {
  let bulbs = []
  for (let i = 0; i < 16; i++) {
    bulbs = bulbs.concat([<MarqueeBulb key={'b' + i} className={'fb-bulb fb-bulb-' + (i % 4)} />])
  }
  return <div className="fb-marquee-lights">{bulbs}</div>
}

/** Catalog titles joined with stars for the LCD billboard. CleverScript-safe. */
function marqueeBoardText(projects) {
  let board = ''
  let list = []
  try {
    if (projects) {
      list = projects
    }
  } catch (e) {
    list = []
  }
  for (let i = 0; i < list.length; i++) {
    let t = projectTitle(list[i])
    if (t.length > 0) {
      if (board.length === 0) {
        board = '★ ' + t
      } else {
        board = board + ' ★ ' + t
      }
    }
  }
  if (board.length === 0) {
    return '★ no titles yet ★ '
  }
  return board + ' ★ '
}

function MarqueeBoard(props) {
  let board = marqueeBoardText(props.projects)
  let n = board.length
  if (n < 1) {
    n = 1
  }
  let dur = n * 0.42
  let track = board + board
  let css =
    '@keyframes fb-lcd-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
    '@media (prefers-reduced-motion:no-preference){.fb-lcd-track{animation:fb-lcd-scroll ' +
    dur +
    's steps(' +
    n +
    ') infinite}}' +
    '@media (prefers-reduced-motion:reduce){.fb-lcd-track{animation:none!important;transform:none!important}}'
  return (
    <div className="fb-marquee-board">
      <style>{css}</style>
      <p className="fb-marquee-label">now showing</p>
      <div className="fb-lcd" aria-label={board}>
        <span className="fb-lcd-end" aria-hidden="true">
          ★
        </span>
        <div className="fb-lcd-window" aria-hidden="true">
          <div className="fb-lcd-track">{track}</div>
        </div>
        <span className="fb-lcd-end" aria-hidden="true">
          ★
        </span>
      </div>
    </div>
  )
}

export default function FlashbackApp() {
  ensureOwnershipAckFromBrowser()
  const route = initialRoute()
  const kind = routeKind(route)
  if (kind.kind === 'movie' && kind.slug) {
    ensureMovieOwnAckFromBrowser(kind.slug)
  }

  let projects = []
  try {
    const res = fetch('/index.json')
    if (res && res.ok === true && res.text) {
      const data = JSON.parse(res.text)
      if (data && data.projects) {
        projects = data.projects
      }
    }
  } catch (e) {
    projects = []
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
  if (kind.kind === 'md') {
    md = fetchText(kind.file)
  }

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
    if (mediaUnlocked !== true) {
      return
    }
    setCommand(1)
    setCommandSeq(commandSeq + 1)
    setPlaying(true)
    try {
      const v = mediaVideoEl()
      if (v && v.play) {
        v.play()
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
    setCommand(2)
    setCommandSeq(commandSeq + 1)
    setPlaying(false)
    try {
      const v = mediaVideoEl()
      if (v && v.pause) {
        v.pause()
      }
    } catch (ePause) {}
  }

  function titleCard(p) {
    const status = p.status || 'wip'
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
          <span className="fb-title-card-meta">{status}</span>
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
  if (kind.kind === 'md') {
    main = (
      <article className="fb-doc fb-prose">
        <MarkdownRenderer content={md || '# Loading…'} />
      </article>
    )
  } else if (kind.kind === 'movie') {
    const movieCid = selected && selected.media ? resolveProjectCid(selected) : ''
    main = (
      <div className="fb-movie">
        <button type="button" className="fb-back" onClick={() => { navigate('/') }}>
          ← Library
        </button>
        <h1 className="fb-movie-title">{selected ? selected.title : kind.slug}</h1>
        {selected && selected.blurb ? (
          <div className="fb-movie-blurb fb-prose">
            <MarkdownRenderer content={selected.blurb} />
          </div>
        ) : null}
        {selected && selected.media ? (
          <div className="fb-video-panel">
            {/* Static SSR tree: inject + CSS toggle unlock (CleverScript cannot swap branches post-hydrate). */}
            <div className="fb-media fb-media-locked" aria-hidden="true">
              <p className="fb-media-msg">
                {"Playback unlocks after you confirm ownership below."}
              </p>
            </div>
            <div className="fb-media-unlock-target">
              {/*
                Inspect must be in this SSR unlock target — RelayMedia never mounts
                (@clevertree/video). No <video> / relayAssetStatus here (SSR hang).
                CID from .ipfs stub only.
              */}
              <div className="fb-media fb-media-pending" data-relay-media="pending">
                <p className="fb-media-msg">This file needs to be seeded</p>
                <p className="fb-media-hint">
                  The content hash is known. Until a peer seeds the bytes onto IPFS, playback cannot start.
                </p>
                {renderIpfsInspect(movieCid)}
              </div>
            </div>
            <MovieOwnAck
              slug={selected.slug}
              originalTitle={projectOriginalTitle(selected)}
              title={projectTitle(selected)}
              needWelcome={ack !== true}
              onAck={() => {
                setMovieAck(true)
              }}
            />
            <div className="fb-video-controls">
              <button
                type="button"
                className="fb-btn fb-btn-primary"
                onClick={sendPlay}
              >
                <PlayChevron className="fb-btn-icon" /> Play
              </button>
              <button
                type="button"
                className="fb-btn"
                onClick={sendPause}
              >
                Pause
              </button>
            </div>
          </div>
        ) : (
          <p className="fb-movie-nomedia">Feature media is not catalogued yet for this title.</p>
        )}
        <div className="fb-readme fb-prose">
          <MarkdownRenderer content={readmeBody(readme) || '# Loading…'} />
        </div>
      </div>
    )
  } else {
    main = (
      <div className="fb-home">
        <RecentSlideshow projects={projects} />
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

  return (
    <StyleContext src="hooks/client/theme.yaml">
      <div className="fb-app">
        <style>
          {'@keyframes fb-glow-pulse{0%,100%{opacity:0.55}50%{opacity:0.95}}@keyframes fb-bulb{0%,100%{opacity:0.4}50%{opacity:1}}@media (prefers-reduced-motion:no-preference){.fb-screen-glow{animation:fb-glow-pulse 5.5s ease-in-out infinite}.fb-bulb-0{animation:fb-bulb 2.2s ease-in-out infinite}.fb-bulb-1{animation:fb-bulb 2.2s ease-in-out 0.4s infinite}.fb-bulb-2{animation:fb-bulb 2.2s ease-in-out 0.8s infinite}.fb-bulb-3{animation:fb-bulb 2.2s ease-in-out 1.2s infinite}}@media (prefers-reduced-motion:reduce){.fb-screen-glow,.fb-bulb{animation:none!important}}'}
        </style>
        <div className="fb-backdrop" aria-hidden="true">
          <div className="fb-curtain fb-curtain-left" />
          <div className="fb-curtain fb-curtain-right" />
          <div className="fb-screen-glow" />
          <SeatRows />
        </div>
        {kind.kind !== 'movie' && (live !== true || hasOwnershipAck() !== true) ? (
          <OwnershipGate
            onAck={() => {
              setAck(true)
            }}
          />
        ) : null}
        <header className="fb-header">
          <a className="fb-brand" href="/" onClick={(e) => {
            try { e.preventDefault() } catch (err) {}
            navigate('/')
          }}>
            <TicketIcon />
            <span className="fb-brand-text">
              <span className="fb-brand-name">Flashback Repository</span>
              <span className="fb-brand-tag">Watchable Fan-Edits of New and Classic Movies</span>
            </span>
          </a>
          <nav className="fb-nav">
            <a href="/" onClick={(e) => { try { e.preventDefault() } catch (err) {} navigate('/') }}>Library</a>
            <a href="/motivation" onClick={(e) => { try { e.preventDefault() } catch (err) {} navigate('/motivation') }}>Why</a>
            <a href="/legal" onClick={(e) => { try { e.preventDefault() } catch (err) {} navigate('/legal') }}>Legal</a>
          </nav>
        </header>
        <div className="fb-marquee">
          <MarqueeLights />
          <MarqueeBoard projects={projects} />
          <MarqueeLights />
        </div>
        <main className="fb-main">{main}</main>
        <footer className="fb-footer">
          <span className="fb-footer-brand">Flashback Repository</span>
          <span className="fb-footer-links">
            <a href="/motivation">Why we’re doing this</a>
            {' · '}
            <a href="/legal">Ownership</a>
            {' · '}
            <a href="/terms">Terms</a>
          </span>
        </footer>
      </div>
    </StyleContext>
  )
}
