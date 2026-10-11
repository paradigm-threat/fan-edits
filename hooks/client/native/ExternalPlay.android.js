/**
 * Android CleverScript host for ExternalPlay — Ways to watch parity with web host.
 * Stream = Now showing (server tip) only. Download = IPFS CID only.
 */
import React from 'react'

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
  const disableWeb =
    p.disableWeb === true || propStr(p, 'disableWeb') === 'true' || propStr(p, 'data-disable-web') === 'true'
  const disableMobile =
    p.disableMobile === true ||
    propStr(p, 'disableMobile') === 'true' ||
    propStr(p, 'data-disable-mobile') === 'true'
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
    out = out.concat([{ kind: kind, label: label, url: url, disabled: false }])
  }
  push('master', 'Full quality', master)
  // Hide 1080p/720p until Bunny ladder URLs exist (disable* means not ready).
  if (!disableWeb) push('web', '1080p', web)
  if (!disableMobile) push('mobile', '720p', mobile)
  return out
}

export default function ExternalPlay(props) {
  const p = props || {}
  const ladder = buildLadder(p)
  const activeIndex = 0

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

  const active = ladder[activeIndex] || null
  const abs = catalogShowing && active ? active.url : ''
  const intentHref = abs ? intentHrefFor(abs) : ''
  const dlLabel =
    !active || active.kind === 'master' || /\.mkv($|\?)/i.test(downloadName)
      ? 'Download MKV'
      : 'Download MP4'

  let origin = 'https://flashbackrepository.org'
  try {
    if (globalThis.location && globalThis.location.origin) {
      origin = globalThis.location.origin
    }
  } catch (eOrigin) {}
  let dlHref = ''
  if (catalogShowing && abs) {
    dlHref = abs
  } else if (inCatalog) {
    dlHref = origin + '/ipfs/' + masterCid
  }

  if (!downloadName) {
    try {
      const parts = String(abs || dlHref || '').split('/')
      downloadName = parts.length ? parts[parts.length - 1] : 'movie.mkv'
      const q = downloadName.indexOf('?')
      if (q >= 0) downloadName = downloadName.slice(0, q)
      downloadName = decodeURIComponent(downloadName)
    } catch (eName) {
      downloadName = 'movie.mkv'
    }
  }

  // Stream exclusive to Now showing — never tip-path probes for other titles.
  const streamOn = unlocked === true && catalogShowing === true && !!abs
  const downloadOn = unlocked === true && !!dlHref

  let streamStatus = 'Confirm ownership above first.'
  if (unlocked === true) {
    if (catalogShowing && abs) {
      streamStatus = 'Ready on Bunny CDN (Now showing).'
    } else {
      streamStatus =
        'Not Now showing. Use Download via IPFS or Request Drive links.'
    }
  }

  let dlStatus = 'Confirm ownership above first.'
  if (unlocked === true) {
    if (catalogShowing && abs) {
      dlStatus = 'Ready to download MKV from Bunny CDN.'
    } else if (inCatalog) {
      dlStatus = 'Ready to download via IPFS.'
    } else {
      dlStatus = 'This title is not in the IPFS catalog yet.'
    }
  }

  let qualityRow = null
  if (catalogShowing && ladder.length > 1) {
    let buttons = []
    for (let i = 0; i < ladder.length; i++) {
      const on = i === activeIndex
      buttons = buttons.concat([
        <button
          type="button"
          className={on ? 'fb-btn fb-btn-quality is-active' : 'fb-btn fb-btn-quality'}
          role="radio"
          aria-checked={on ? 'true' : 'false'}
        >
          {ladder[i].label}
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
  const dlCls = downloadOn
    ? 'fb-btn fb-theater-download-mkv'
    : 'fb-btn fb-theater-download-mkv is-disabled'

  return (
    <div
      className="fb-external-play fb-theater-external fb-ways-to-watch"
      data-fb-external-play="1"
      data-playback-engine="external"
      data-fb-catalog-status={catalogStatus || 'unknown'}
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
