/**
 * Android CleverScript host for ExternalPlay — Ways to watch parity with web host.
 * Stream / Bunny download = Now showing. Catalog = clickable ipfs:// (no site gateway).
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
  const setupIpfsHref =
    setupHref.indexOf('#') >= 0 ? setupHref : setupHref.replace(/\/?$/, '') + '#ipfs'
  const catalogStatus = (propStr(p, 'status') || propStr(p, 'data-status') || '').toLowerCase()
  const catalogShowing = catalogStatus === 'showing'

  let masterCid = ''
  try {
    masterCid = propStr(p, 'cid') || propStr(p, 'data-cid') || ''
  } catch (eCid) {}
  const inCatalog = masterCid.length >= 8
  const ipfsUri = inCatalog ? 'ipfs://' + masterCid : ''

  let downloadName = ''
  try {
    downloadName = propStr(p, 'downloadName') || propStr(p, 'data-download-name') || ''
  } catch (eDn) {}

  const active = ladder[activeIndex] || null
  const abs = catalogShowing && active ? active.url : ''
  const intentHref = abs ? intentHrefFor(abs) : ''
  // Ladder + master are always MKV (no H.264 MP4 product).
  const dlLabel = 'Download MKV'

  // Bunny HTTPS for Now showing only — never site /ipfs/ gateway.
  let bunnyHref = ''
  if (catalogShowing && abs) {
    bunnyHref = abs
  }

  if (!downloadName && bunnyHref) {
    try {
      const parts = String(bunnyHref).split('/')
      downloadName = parts.length ? parts[parts.length - 1] : 'movie.mkv'
      const q = downloadName.indexOf('?')
      if (q >= 0) downloadName = downloadName.slice(0, q)
      downloadName = decodeURIComponent(downloadName)
    } catch (eName) {
      downloadName = 'movie.mkv'
    }
  }

  const streamOn = unlocked === true && catalogShowing === true && !!abs
  const bunnyOn = unlocked === true && !!bunnyHref
  const ipfsOn = unlocked === true && inCatalog && !!ipfsUri

  let streamStatus = 'Confirm ownership above first.'
  if (unlocked === true) {
    if (catalogShowing && abs) {
      streamStatus = 'Ready on Bunny CDN (Now showing).'
    } else {
      streamStatus =
        'Not Now showing. Open the IPFS link below, use the Flashback App, or Request Drive.'
    }
  }

  let dlStatus = 'Confirm ownership above first.'
  if (unlocked === true) {
    if (catalogShowing && abs) {
      dlStatus = 'Ready to download MKV from Bunny CDN.'
    } else if (inCatalog) {
      dlStatus = 'Open the IPFS link in a supporting client (see Setup).'
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
  const bunnyCls = bunnyOn
    ? 'fb-btn fb-theater-download-mkv'
    : 'fb-btn fb-theater-download-mkv is-disabled'
  const ipfsCls = ipfsOn
    ? 'fb-btn fb-theater-ipfs-uri'
    : 'fb-btn fb-theater-ipfs-uri is-disabled'

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
          Works for Now showing titles (Bunny CDN HTTPS). Other titles: open the IPFS link below,
          use the Flashback App, or Request Drive.
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
        <h3 className="fb-ways-section-title">
          {catalogShowing ? '2. Download the file' : '2. Open over IPFS'}
        </h3>
        <p className="fb-ways-section-help">
          {catalogShowing
            ? 'Saves the MKV from Bunny CDN (Now showing). Open it in VLC when it finishes.'
            : 'Catalog masters are content hashes on IPFS — not a download from this site. Open the link in a supporting client, or use the Flashback App.'}
        </p>
        <div className="fb-ways-actions fb-theater-external-actions">
          {catalogShowing ? (
            <a
              className={bunnyCls}
              href={bunnyOn ? bunnyHref : undefined}
              download={bunnyHref && bunnyHref.indexOf('b-cdn.net') < 0 ? downloadName : undefined}
              aria-disabled={bunnyOn ? 'false' : 'true'}
              onClick={(ev) => {
                if (!bunnyOn) ev.preventDefault()
              }}
            >
              {dlLabel}
            </a>
          ) : (
            <a
              className={ipfsCls}
              href={ipfsOn ? ipfsUri : undefined}
              rel="noopener noreferrer"
              aria-disabled={ipfsOn ? 'false' : 'true'}
              onClick={(ev) => {
                if (!ipfsOn) ev.preventDefault()
              }}
            >
              {ipfsUri || 'No IPFS CID'}
            </a>
          )}
        </div>
        {!catalogShowing && inCatalog ? (
          <p className="fb-ways-helpers fb-ways-ipfs-how">
            <a className="fb-link" href={setupIpfsHref}>
              How to open IPFS links
            </a>
            {' (Setup) · '}
            <a className="fb-link" href="/app">
              Flashback App
            </a>
          </p>
        ) : null}
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
