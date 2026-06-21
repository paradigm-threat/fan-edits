/**
 * fan-edits library — index.json drives nav; each slug is a viewable project page.
 */
import React, { useState, useEffect } from 'react'
import { MarkdownRenderer } from '@clevertree/markdown'
import { VideoPlayer } from '@clevertree/video'

function mediaSrc(project) {
  if (!project || !project.media) return ''
  return '/' + project.path + '/' + project.media
}

function subtitleTracks(project) {
  if (!project || !project.subtitles) return []
  return project.subtitles.map((t) => ({
    src: t.src.startsWith('/') ? t.src : '/' + t.src,
    label: t.label || 'Subtitles',
    lang: t.lang || 'en',
    default: t.default === true,
  }))
}

function findProject(projects, slug) {
  for (let i = 0; i < projects.length; i++) {
    if (projects[i].slug === slug) return projects[i]
  }
  return null
}

function projectsInCategory(projects, category) {
  return projects.filter((p) => p.category === category)
}

function navItem(p, slug, setSlug) {
  const active = slug === p.slug
  return (
    <li key={p.slug}>
      <button
        className={active ? 'nav-link nav-link-active' : 'nav-link'}
        onClick={() => setSlug(p.slug)}
      >
        {p.title}
      </button>
    </li>
  )
}

export default function FanEditsLibrary() {
  const [projects, setProjects] = useState([])
  const [slug, setSlug] = useState('')
  const [readme, setReadme] = useState('')
  const [readmeError, setReadmeError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [commandSeq, setCommandSeq] = useState(0)
  const [command, setCommand] = useState(0)

  useEffect(() => {
    const res = fetch('/index.json')
    if (res && res.ok === true && res.text) {
      try {
        const data = JSON.parse(res.text)
        if (data && data.projects) {
          setProjects(data.projects)
        }
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (!slug) {
      setReadme('')
      setReadmeError('')
      setPlaying(false)
      return
    }
    const project = findProject(projects, slug)
    if (!project) {
      setReadmeError('Project not found')
      setReadme('')
      return
    }
    const path = project.path + '/README.md'
    const res = fetch('/' + path)
    if (res && res.ok === true && res.text) {
      setReadme(res.text)
      setReadmeError('')
    } else {
      let st = 0
      if (res && res.status) st = res.status
      setReadmeError('Could not load README (HTTP ' + st + ')')
      setReadme('')
    }
  }, [slug, projects])

  const selected = slug ? findProject(projects, slug) : null
  const fanMixes = projectsInCategory(projects, 'FanMixes')
  const kidFriendly = projectsInCategory(projects, 'KidFriendly')

  function sendPlaybackCommand(cmd) {
    setCommand(cmd)
    setCommandSeq(commandSeq + 1)
    if (cmd === 1) setPlaying(true)
    if (cmd === 2) setPlaying(false)
  }

  return (
    <div className="library-app">
      <header className="library-header">
        <div className="library-header-brand">
          <span className="library-header-icon" aria-hidden="true">
            ▶
          </span>
          <div>
            <h1 className="library-header-title">Fan Edits</h1>
            <p className="library-header-tagline">Family-safe cuts &amp; fan mixes</p>
          </div>
        </div>
        <p className="library-header-meta">{projects.length} titles</p>
      </header>
      <div className="library-body">
        <aside className="library-nav">
          <button
            className={slug === '' ? 'nav-link nav-link-active' : 'nav-link'}
            onClick={() => setSlug('')}
          >
            Library home
          </button>
          <h3 className="nav-heading">FanMixes</h3>
          <ul className="nav-list">{fanMixes.map((p) => navItem(p, slug, setSlug))}</ul>
          <h3 className="nav-heading">KidFriendly</h3>
          <ul className="nav-list">{kidFriendly.map((p) => navItem(p, slug, setSlug))}</ul>
        </aside>
        <main className="library-main">
          {!slug ? (
            <div className="library-home">
              <h2>Family-safe and fan-mix projects</h2>
              <p className="catalog-lead">
                Select a project in the sidebar. Source media lives in the checkout (gitignored);
                published assets resolve via IPFS stubs in git.
              </p>
              <p>{projects.length} projects in index.json</p>
            </div>
          ) : (
            <div className="project-page">
              <h2>{selected ? selected.title : slug}</h2>
              {selected && selected.reel ? (
                <p className="project-meta">Reel: {selected.reel}</p>
              ) : null}
              {selected && selected.media ? (
                <div className="video-panel">
                  <VideoPlayer
                    src={mediaSrc(selected)}
                    controls={true}
                    playing={playing}
                    command={command}
                    commandSeq={commandSeq}
                    subtitles={subtitleTracks(selected)}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                  />
                  <div className="video-controls">
                    <button className="nav-btn" onClick={() => sendPlaybackCommand(1)}>
                      Play
                    </button>
                    <button className="nav-btn" onClick={() => sendPlaybackCommand(2)}>
                      Pause
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="readme-panel">
                <MarkdownRenderer
                  content={
                    readmeError
                      ? '# Error\n\n' + readmeError
                      : readme || '# Loading…'
                  }
                />
              </div>
              <p className="phase-note">Phase 3: native timeline editor for this project.</p>
            </div>
          )}
        </main>
      </div>
      <footer className="library-footer">
        <span className="library-footer-brand">Relay video library</span>
        <span className="library-footer-note">CleverScript UI · shared theme across web &amp; desktop</span>
      </footer>
    </div>
  )
}
