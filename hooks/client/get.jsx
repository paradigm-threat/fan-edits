/**
 * Flashback Repository — theater shell (SSR + hydrate).
 */
import React, { useState, useEffect } from 'react'
import StyleContext from '@clevertree/style'
import { MarkdownRenderer } from '@clevertree/markdown'
import manifest from '@hooks'
import { TicketIcon, PlayChevron, MarqueeBulb } from 'hooks/client/components/Icons.jsx'
import OwnershipGate, { hasOwnershipAck } from 'hooks/client/components/OwnershipGate.jsx'
import MovieOwnAck, { hasMovieOwnAck } from 'hooks/client/components/MovieOwnAck.jsx'
import RelayMedia from 'hooks/client/components/RelayMedia.jsx'

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
    if (typeof location !== 'undefined' && location.pathname) {
      return normalizeRoute(location.pathname)
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
  const out = []
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
    out.push(track)
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

function projectsInCategory(projects, category) {
  const out = []
  for (let i = 0; i < projects.length; i++) {
    if (projects[i].category === category) {
      out.push(projects[i])
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
    const res = fetch('/' + p)
    if (res && res.ok === true && res.text) {
      return res.text
    }
  } catch (e) {}
  return ''
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
    if (typeof window === 'undefined') {
      return true
    }
    if (!window.matchMedia) {
      return window.innerWidth < 900
    }
    return window.matchMedia('(max-width: 900px)').matches === true
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
    if (typeof location !== 'undefined') {
      location.href = p
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
  const bulbs = []
  for (let i = 0; i < 16; i++) {
    bulbs.push(<MarqueeBulb key={'b' + i} className={'fb-bulb fb-bulb-' + (i % 4)} />)
  }
  return <div className="fb-marquee-lights">{bulbs}</div>
}

export default function FlashbackApp() {
  const route = initialRoute()
  const kind = routeKind(route)

  const projectsState = useState([])
  const projects = projectsState[0]
  const setProjects = projectsState[1]

  const readmeState = useState('')
  const readme = readmeState[0]
  const setReadme = readmeState[1]

  const mdState = useState('')
  const md = mdState[0]
  const setMd = mdState[1]

  const homeState = useState('')
  const homeMd = homeState[0]
  const setHomeMd = homeState[1]

  const blogState = useState([])
  const blogPosts = blogState[0]
  const setBlogPosts = blogState[1]

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
  const ack = ackState[0]
  const setAck = ackState[1]

  const movieAckState = useState(false)
  const movieAck = movieAckState[0]
  const setMovieAck = movieAckState[1]

  useEffect(function () {
    if (kind.kind === 'movie' && kind.slug) {
      setMovieAck(hasMovieOwnAck(kind.slug) === true)
    } else {
      setMovieAck(false)
    }
  }, [kind.kind, kind.slug])

  useEffect(function () {
    const res = fetch('/index.json')
    if (res && res.ok === true && res.text) {
      try {
        const data = JSON.parse(res.text)
        if (data && data.projects) {
          setProjects(data.projects)
        }
      } catch (e) {}
    }
    if (kind.kind === 'home') {
      setHomeMd(fetchText('content/home.md'))
      const posts = []
      try {
        const raw = fetchText('content/blog/index.json')
        const data = raw ? JSON.parse(raw) : null
        const list = data && data.posts ? data.posts : []
        for (let i = 0; i < list.length; i++) {
          const meta = list[i]
          if (!meta || !meta.path) {
            continue
          }
          posts.push({
            slug: meta.slug || '',
            date: meta.date || '',
            title: meta.title || 'Post',
            body: fetchText(meta.path) || '',
          })
        }
      } catch (e) {}
      setBlogPosts(posts)
    }
    if (kind.kind === 'md') {
      setMd(fetchText(kind.file))
    }
  }, [])

  useEffect(function () {
    if (kind.kind !== 'movie') {
      setReadme('')
      return
    }
    const project = findProject(projects, kind.slug)
    if (!project) {
      setReadme('')
      return
    }
    setReadme(fetchText(project.path + '/README.md'))
  }, [projects, kind.kind, kind.slug])

  const selected = kind.kind === 'movie' ? findProject(projects, kind.slug) : null
  const fanMixes = projectsInCategory(projects, 'FanMixes')
  const kidFriendly = projectsInCategory(projects, 'KidFriendly')

  function sendPlay() {
    if (ack !== true) {
      return
    }
    if (movieAck !== true) {
      return
    }
    setCommand(1)
    setCommandSeq(commandSeq + 1)
    setPlaying(true)
    if (isNarrowViewport()) {
      try {
        const root = document.querySelector('.fb-media-ready') || document.querySelector('.fb-video-panel')
        requestFs(root)
      } catch (e) {}
    }
  }

  function sendPause() {
    setCommand(2)
    setCommandSeq(commandSeq + 1)
    setPlaying(false)
  }

  function titleCard(p) {
    const status = p.status || 'wip'
    return (
      <button
        key={p.slug}
        type="button"
        className={'fb-title-card fb-status-' + status}
        onClick={function () {
          navigate('/' + p.slug)
        }}
      >
        <span className="fb-title-card-mark">
          <PlayChevron />
        </span>
        <span className="fb-title-card-body">
          <span className="fb-title-card-name">{p.title}</span>
          {p.blurb ? <span className="fb-title-card-blurb">{p.blurb}</span> : null}
          <span className="fb-title-card-meta">{status}</span>
        </span>
      </button>
    )
  }

  const fanCards = []
  for (let i = 0; i < fanMixes.length; i++) {
    fanCards.push(titleCard(fanMixes[i]))
  }
  const kidCards = []
  for (let i = 0; i < kidFriendly.length; i++) {
    kidCards.push(titleCard(kidFriendly[i]))
  }
  const blogCards = []
  for (let i = 0; i < blogPosts.length; i++) {
    const post = blogPosts[i]
    blogCards.push(
      <article key={post.slug || post.title} className="fb-blog-post">
        {post.date ? <p className="fb-blog-date">{post.date}</p> : null}
        <h3 className="fb-blog-title">{post.title}</h3>
        <div className="fb-blog-body">
          <MarkdownRenderer content={post.body || ''} />
        </div>
      </article>
    )
  }

  let main = null
  if (kind.kind === 'md') {
    main = (
      <article className="fb-doc">
        <MarkdownRenderer content={md || '# Loading…'} />
      </article>
    )
  } else if (kind.kind === 'movie') {
    main = (
      <div className="fb-movie">
        <button type="button" className="fb-back" onClick={function () { navigate('/') }}>
          ← Library
        </button>
        <h1 className="fb-movie-title">{selected ? selected.title : kind.slug}</h1>
        {selected && selected.blurb ? <p className="fb-movie-blurb">{selected.blurb}</p> : null}
        {selected && selected.media ? (
          <div className="fb-video-panel">
            {ack === true && movieAck === true ? (
              <RelayMedia
                src={mediaSrc(selected)}
                subtitles={subtitleTracks(selected)}
                playing={playing}
                command={command}
                commandSeq={commandSeq}
                onPlay={function () { setPlaying(true) }}
                onPause={function () { setPlaying(false) }}
              />
            ) : (
              <div className="fb-media fb-media-locked">
                <p className="fb-media-msg">
                  {ack !== true
                    ? 'Confirm ownership on the welcome screen to continue.'
                    : 'One quick check on this title, then Play.'}
                </p>
              </div>
            )}
            {ack === true && movieAck !== true ? (
              <MovieOwnAck
                slug={selected.slug}
                title={selected.title}
                onAck={function () {
                  setMovieAck(true)
                }}
              />
            ) : null}
            <div className="fb-video-controls">
              <button
                type="button"
                className="fb-btn fb-btn-primary"
                onClick={sendPlay}
                disabled={ack !== true || movieAck !== true}
              >
                <PlayChevron className="fb-btn-icon" /> Play
              </button>
              <button
                type="button"
                className="fb-btn"
                onClick={sendPause}
                disabled={ack !== true || movieAck !== true}
              >
                Pause
              </button>
            </div>
          </div>
        ) : (
          <p className="fb-movie-nomedia">Feature media is not catalogued yet for this title.</p>
        )}
        <div className="fb-readme">
          <MarkdownRenderer content={readmeBody(readme) || '# Loading…'} />
        </div>
      </div>
    )
  } else {
    main = (
      <div className="fb-home">
        <div className="fb-home-lead">
          <div className="fb-home-intro">
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
        <OwnershipGate
          onAck={function () {
            setAck(true)
          }}
        />
        <header className="fb-header">
          <a className="fb-brand" href="/" onClick={function (e) {
            try { e.preventDefault() } catch (err) {}
            navigate('/')
          }}>
            <TicketIcon />
            <span className="fb-brand-text">
              <span className="fb-brand-name">Flashback Repository</span>
              <span className="fb-brand-tag">Own the original · then improve it</span>
            </span>
          </a>
          <nav className="fb-nav">
            <a href="/" onClick={function (e) { try { e.preventDefault() } catch (err) {} navigate('/') }}>Library</a>
            <a href="/motivation" onClick={function (e) { try { e.preventDefault() } catch (err) {} navigate('/motivation') }}>Why</a>
            <a href="/legal" onClick={function (e) { try { e.preventDefault() } catch (err) {} navigate('/legal') }}>Legal</a>
          </nav>
        </header>
        <div className="fb-marquee">
          <MarqueeLights />
          <p className="fb-marquee-text">
            {projects.length} titles · personal fan edits · thin IPFS
          </p>
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
