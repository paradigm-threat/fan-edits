/**
 * Android CleverScript host for ExternalPlay — Ways to watch parity with web host.
 */
import React, { useEffect, useState } from 'react'

function propStr(p, key) {
  try {
    if (p && p[key] !== null && p[key] !== undefined) {
      return '' + p[key]
    }
  } catch (e) {}
  return ''
}

function absoluteHref(href) {
  const h = '' + (href || '')
  if (h.length === 0) {
    return ''
  }
  if (h.indexOf('http://') === 0 || h.indexOf('https://') === 0) {
    return h
  }
  try {
    if (typeof location !== 'undefined' && location.href) {
      const origin = location.protocol + '//' + location.host
      if (h.charAt(0) === '/') {
        return origin + h
      }
    }
  } catch (e2) {}
  return h
}

function intentHrefFor(abs) {
  if (abs.indexOf('https://') === 0 || abs.indexOf('http://') === 0) {
    return (
      'intent:' +
      abs +
      '#Intent;action=android.intent.action.VIEW;type=video/*;scheme=https;end'
    )
  }
  return abs
}

function buildLadder(p) {
  const master = absoluteHref(propStr(p, 'streamUrl'))
  const web = absoluteHref(propStr(p, 'streamUrlWeb'))
  const mobile = absoluteHref(propStr(p, 'streamUrlMobile'))
  let out = []
  function push(kind, label, url) {
    if (!url || url.length === 0) {
      return
    }
    for (let i = 0; i < out.length; i++) {
      if (out[i].url === url) {
        return
      }
    }
    out = out.concat([{ kind: kind, label: label, url: url }])
  }
  push('master', 'Full quality', master)
  push('web', '1080p', web)
  push('mobile', '720p', mobile)
  return out
}

function parseSeed(j) {
  if (!j || typeof j !== 'object') {
    return { ready: false, checking: false }
  }
  const seed = j.seed && typeof j.seed === 'object' ? j.seed : {}
  const state = typeof seed.state === 'string' ? seed.state : ''
  const providers = typeof seed.providers === 'number' ? seed.providers : null
  if (j.error === 'ok' || state === 'cached') {
    return { ready: true, checking: false }
  }
  if (state === 'fetching') {
    return { ready: false, checking: false }
  }
  if (providers === 0) {
    return { ready: false, checking: false }
  }
  return { ready: false, checking: false }
}

export default function ExternalPlay(props) {
  const p = props || {}
  const ladder = buildLadder(p)
  const idxState = useState(0)
  const activeIndex = idxState[0]
  const setActiveIndex = idxState[1]
  const seedReadyState = useState(false)
  const gatewayReady = seedReadyState[0]
  const setGatewayReady = seedReadyState[1]
  const seedPhaseState = useState('checking')
  const seedPhase = seedPhaseState[0]
  const setSeedPhase = seedPhaseState[1]

  let unlocked = false
  try {
    if (p.unlocked === true || propStr(p, 'unlocked') === 'true') {
      unlocked = true
    }
  } catch (e) {}
  const setupHref = propStr(p, 'setupHref') || '/setup'
  const catalogStatus = (propStr(p, 'status') || propStr(p, 'data-status') || '').toLowerCase()
  const catalogShowing = catalogStatus === 'showing'

  let masterCid = ''
  try {
    masterCid = propStr(p, 'cid') || propStr(p, 'data-cid') || ''
  } catch (eCid) {}
  const inCatalog = masterCid.length >= 8

  let downloadName = ''
  try {
    downloadName = propStr(p, 'downloadName') || propStr(p, 'data-download-name') || ''
  } catch (eDn) {}

  if (ladder.length === 0) {
    return (
      <div className="fb-external-play fb-ways-to-watch" data-fb-external-play="1">
        <h2 className="fb-ways-title">Ways to watch this movie</h2>
        <p className="fb-ways-lead">No stream URL for this title yet.</p>
        <section className="fb-ways-section">
          <h3 className="fb-ways-section-title">3. Get links by email</h3>
          <div className="fb-ways-actions">
            <a className="fb-btn fb-theater-request-drive" href="/request">
              Request Drive links
            </a>
          </div>
        </section>
      </div>
    )
  }

  const active = ladder[activeIndex] || ladder[0]
  const abs = active.url
  const intentHref = intentHrefFor(abs)
  const dlLabel = active.kind === 'master' ? 'Download MKV' : 'Download MP4'
  let dlHref = abs
  if (active.kind === 'master' && inCatalog) {
    try {
      const origin =
        globalThis.location && globalThis.location.origin
          ? globalThis.location.origin
          : 'https://flashbackrepository.org'
      dlHref = origin + '/ipfs/' + masterCid
    } catch (eIpfs) {
      dlHref = abs
    }
  }
  if (!downloadName) {
    try {
      const parts = String(abs || '').split('/')
      downloadName = parts.length ? parts[parts.length - 1] : 'movie.mkv'
      const q = downloadName.indexOf('?')
      if (q >= 0) downloadName = downloadName.slice(0, q)
      downloadName = decodeURIComponent(downloadName)
    } catch (eName) {
      downloadName = 'movie.mkv'
    }
  }

  useEffect(() => {
    let cancelled = false
    if (!abs) {
      setSeedPhase('none')
      setGatewayReady(false)
      return
    }
    if (catalogShowing) {
      setGatewayReady(true)
      setSeedPhase('ready')
    } else {
      setGatewayReady(false)
      setSeedPhase('checking')
    }
    const statusUrl = abs + (abs.indexOf('?') >= 0 ? '&' : '?') + 'relayAssetStatus=1'
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null
    const timer =
      ctrl &&
      setTimeout(() => {
        try {
          ctrl.abort()
        } catch (e) {}
      }, 10000)
    fetch(statusUrl, {
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/vnd.relay.asset-status+json, application/json' },
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then((r) => (r ? r.json() : null))
      .then((j) => {
        if (cancelled) return
        const parsed = parseSeed(j)
        if (parsed.ready) {
          setGatewayReady(true)
          setSeedPhase('ready')
        } else {
          setGatewayReady(catalogShowing)
          setSeedPhase(catalogShowing ? 'ready' : 'unavailable')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGatewayReady(catalogShowing)
          setSeedPhase(catalogShowing ? 'ready' : 'unavailable')
        }
      })
      .then(() => {
        if (timer) clearTimeout(timer)
      })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (ctrl) {
        try {
          ctrl.abort()
        } catch (e2) {}
      }
    }
  }, [abs, catalogShowing])

  const serverOk = !!abs && (catalogShowing || gatewayReady === true)
  const streamOn = unlocked === true && serverOk
  const downloadOn = unlocked === true && inCatalog

  let streamStatus = 'Confirm ownership above first.'
  if (unlocked === true) {
    if (!abs) {
      streamStatus = 'No stream URL for this title yet.'
    } else if (seedPhase === 'checking' && !catalogShowing) {
      streamStatus = 'Checking if this server has the file…'
    } else if (serverOk) {
      streamStatus = catalogShowing
        ? 'Ready on this server (Now showing).'
        : 'Ready on this server.'
    } else {
      streamStatus =
        'Not on this server right now. Try Download (if listed) or Request Drive links.'
    }
  }

  let dlStatus = 'Confirm ownership above first.'
  if (unlocked === true) {
    dlStatus = inCatalog
      ? 'Ready to download via IPFS.'
      : 'This title is not in the IPFS catalog yet.'
  }

  let qualityRow = null
  if (ladder.length > 1) {
    let buttons = []
    for (let i = 0; i < ladder.length; i++) {
      const idx = i
      const on = idx === activeIndex
      buttons = buttons.concat([
        <button
          type="button"
          className={on ? 'fb-btn fb-btn-quality is-active' : 'fb-btn fb-btn-quality'}
          role="radio"
          aria-checked={on ? 'true' : 'false'}
          onClick={() => {
            setActiveIndex(idx)
          }}
        >
          {ladder[idx].label}
        </button>,
      ])
    }
    qualityRow = (
      <div className="fb-ways-quality">
        <p className="fb-ways-section-label">Quality</p>
        <div className="fb-external-play-quality" role="radiogroup" aria-label="Stream quality">
          {buttons}
        </div>
      </div>
    )
  }

  const streamCls = streamOn ? 'fb-btn' : 'fb-btn is-disabled'
  const dlCls = downloadOn ? 'fb-btn fb-theater-download-mkv' : 'fb-btn fb-theater-download-mkv is-disabled'

  return (
    <div
      className="fb-external-play fb-theater-external fb-ways-to-watch"
      data-fb-external-play="1"
      data-playback-engine="external"
    >
      <h2 className="fb-ways-title">Ways to watch this movie</h2>
      <p className="fb-ways-lead">
        This browser cannot play the movie file here. Choose one of the three ways below.
      </p>
      {qualityRow}

      <section className="fb-ways-section fb-ways-stream">
        <h3 className="fb-ways-section-title">1. Stream it now</h3>
        <p className="fb-ways-section-help">
          Works when this server has the file ready (Now showing titles).
        </p>
        <div className="fb-ways-actions fb-theater-external-actions">
          <a
            className={streamCls + ' fb-btn-primary fb-btn-external-play fb-theater-open-intent'}
            href={streamOn ? intentHref : undefined}
            aria-disabled={streamOn ? 'false' : 'true'}
            onClick={(ev) => {
              if (!streamOn) ev.preventDefault()
            }}
          >
            Open in external player
          </a>
          <a
            className={streamCls + ' fb-theater-open-https'}
            href={streamOn ? abs : undefined}
            rel="noopener noreferrer"
            aria-disabled={streamOn ? 'false' : 'true'}
            onClick={(ev) => {
              if (!streamOn) ev.preventDefault()
            }}
          >
            Open stream link
          </a>
        </div>
        <p className="fb-ways-status" data-fb-seed-status="1">
          {streamStatus}
        </p>
      </section>

      <section className="fb-ways-section fb-ways-download">
        <h3 className="fb-ways-section-title">2. Download the file</h3>
        <p className="fb-ways-section-help">
          Saves through this site’s IPFS gateway. Open the file in VLC when it finishes.
        </p>
        <div className="fb-ways-actions fb-theater-external-actions">
          <a
            className={dlCls}
            href={downloadOn ? dlHref : undefined}
            download={downloadName}
            aria-disabled={downloadOn ? 'false' : 'true'}
            onClick={(ev) => {
              if (!downloadOn) ev.preventDefault()
            }}
          >
            {dlLabel}
          </a>
        </div>
        <p className="fb-ways-status">{dlStatus}</p>
      </section>

      <section className="fb-ways-section fb-ways-email">
        <h3 className="fb-ways-section-title">3. Get links by email</h3>
        <p className="fb-ways-section-help">
          Send the request email — the automatic reply includes the shared Drive library.
        </p>
        <div className="fb-ways-actions fb-theater-external-actions">
          <a className="fb-btn fb-theater-request-drive" href="/request">
            Request Drive links
          </a>
        </div>
      </section>

      <p className="fb-ways-helpers">
        <a className="fb-link" href={setupHref}>
          Setup / VLC
        </a>
        {' · '}
        <a
          className="fb-link"
          href="https://play.google.com/store/apps/details?id=org.videolan.vlc"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get VLC (Play Store)
        </a>
        {' · '}
        <a className="fb-link" href="/app">
          Flashback App
        </a>
      </p>
    </div>
  )
}
