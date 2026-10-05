/**
 * SSR-safe media unlock panel (parked flashback pages).
 * - Resolves CID from .ipfs stub (sync fetch)
 * - Sync relayAssetStatus for ready vs seed
 * - Native <video> when ready (no @clevertree/video — that drops SSR trees)
 * CleverScript: no ^ regex, no Array.push, arrow cbs, braced if, globalThis;
 * default export only (named re-exports have broken parked SSR before).
 */
import React from 'react'

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

function copyText(text) {
  const t = str(text)
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

function fetchTextPath(path) {
  try {
    let p = str(path)
    if (p.charAt(0) === '/') {
      p = p.slice(1)
    }
    if (p.length === 0) {
      return ''
    }
    const res = fetch('/' + p)
    if (res && res.ok === true && res.text) {
      return res.text
    }
  } catch (e) {}
  return ''
}

function resolveMediaCid(logicalPath) {
  const logical = str(logicalPath).trim()
  if (logical.length === 0) {
    return ''
  }
  let pathNoSlash = logical
  if (pathNoSlash.charAt(0) === '/') {
    pathNoSlash = pathNoSlash.slice(1)
  }
  const stub = fetchTextPath('.relay/assets/' + pathNoSlash + '.ipfs')
  return parseCidFromStub(stub)
}

function encodeCid(cid) {
  const c = str(cid).trim()
  try {
    if (typeof globalThis !== 'undefined' && globalThis.encodeURIComponent) {
      return globalThis.encodeURIComponent(c)
    }
  } catch (e) {}
  return c
}

function IpfsInspectRow(props) {
  let cid = ''
  let providers = null
  try {
    cid = str(props.cid).trim()
  } catch (e) {
    cid = ''
  }
  try {
    if (typeof props.providers === 'number') {
      providers = props.providers
    }
  } catch (e2) {}
  if (!looksLikeCid(cid)) {
    return null
  }
  const enc = encodeCid(cid)
  const inspector = 'https://cid.ipfs.tech/#' + cid
  const check = 'https://check.ipfs.network/?cid=' + enc
  const gatewayIo = 'https://ipfs.io/ipfs/' + enc
  const gatewayDweb = 'https://dweb.link/ipfs/' + enc
  let providerNote = ''
  if (providers !== null) {
    if (providers === 0) {
      providerNote = 'Relay sees 0 providers for this CID.'
    } else if (providers === 1) {
      providerNote = 'Relay sees 1 provider for this CID.'
    } else {
      providerNote = 'Relay sees ' + providers + ' providers for this CID.'
    }
  }
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
            copyText(cid)
          }}
        >
          Copy CID
        </button>
      </div>
      <div className="fb-media-inspect-links">
        <a href={inspector} target="_blank" rel="noopener noreferrer">
          CID Inspector
        </a>
        <a href={check} target="_blank" rel="noopener noreferrer">
          Providers
        </a>
        <a href={gatewayIo} target="_blank" rel="noopener noreferrer">
          ipfs.io
        </a>
        <a href={gatewayDweb} target="_blank" rel="noopener noreferrer">
          dweb.link
        </a>
      </div>
      {providerNote ? <p className="fb-media-inspect-note">{providerNote}</p> : null}
      <p className="fb-media-inspect-note">
        Public gateway fetches from this page are often CORS-blocked; use the links. Seed status is from Relay.
      </p>
    </div>
  )
}

function statusUrl(src) {
  let u = str(src).trim()
  if (u.length === 0) {
    return ''
  }
  const join = u.indexOf('?') >= 0 ? '&' : '?'
  return u + join + 'relayAssetStatus=1'
}

function parseStatus(resp) {
  const empty = {
    ok: false,
    retryable: false,
    error: 'unknown',
    message: '',
    progressPct: null,
    seedState: 'unknown',
    providers: null,
    cid: '',
  }
  if (!resp) {
    return empty
  }
  if (resp.ok === true && resp.status === 200) {
    try {
      const text = resp.text ? resp.text : ''
      if (text.length > 0 && text.charAt(0) === '{') {
        const data = JSON.parse(text)
        if (data && data.error && data.error !== 'ok') {
          /* fall through */
        } else {
          let cidReady = ''
          try {
            if (data && typeof data.cid === 'string') {
              cidReady = data.cid
            }
          } catch (eCid) {}
          return {
            ok: true,
            retryable: false,
            error: 'ok',
            message: 'ready',
            progressPct: 100,
            seedState: 'cached',
            providers: null,
            cid: cidReady,
          }
        }
      } else {
        return {
          ok: true,
          retryable: false,
          error: 'ok',
          message: 'ready',
          progressPct: 100,
          seedState: 'cached',
          providers: null,
          cid: '',
        }
      }
    } catch (e) {
      return {
        ok: true,
        retryable: false,
        error: 'ok',
        message: 'ready',
        progressPct: 100,
        seedState: 'cached',
        providers: null,
        cid: '',
      }
    }
  }
  let text = resp.text ? resp.text : ''
  if (text.length === 0) {
    return {
      ok: false,
      retryable: resp.status === 425 || resp.status === 503 || resp.status === 504 || resp.status === 502,
      error: 'http-' + resp.status,
      message: 'HTTP ' + resp.status,
      progressPct: null,
      seedState: 'unknown',
      providers: null,
      cid: '',
    }
  }
  try {
    const data = JSON.parse(text)
    const seed = data && data.seed ? data.seed : {}
    return {
      ok: data.error === 'ok',
      retryable: data.retryable === true,
      error: typeof data.error === 'string' ? data.error : 'unknown',
      message: typeof data.message === 'string' ? data.message : '',
      progressPct: typeof seed.progressPct === 'number' ? seed.progressPct : null,
      seedState: typeof seed.state === 'string' ? seed.state : 'unknown',
      providers: typeof seed.providers === 'number' ? seed.providers : null,
      cid: typeof data.cid === 'string' ? data.cid : '',
    }
  } catch (e2) {
    return empty
  }
}

function statusLabel(st) {
  if (st.ok) {
    return 'Ready'
  }
  if (st.seedState === 'fetching') {
    if (st.progressPct !== null) {
      return 'Seeding… ' + st.progressPct + '%'
    }
    return 'Seeding from the network…'
  }
  if (st.seedState === 'unavailable' || st.error === 'ipfs-not-found') {
    return 'This file needs to be seeded'
  }
  if (st.seedState === 'missing' || st.error === 'ipfs-pending') {
    return 'This file needs to be seeded — retrying…'
  }
  if (st.error === 'ipfs-busy') {
    return 'Busy — retrying…'
  }
  if (st.error === 'ipfs-gateway-timeout') {
    return 'Gateway timeout — retrying…'
  }
  if (st.message) {
    return st.message
  }
  return 'This file needs to be seeded'
}

function logicalFromSrc(src) {
  let u = str(src).trim()
  if (u.charAt(0) === '/') {
    u = u.slice(1)
  }
  const q = u.indexOf('?')
  if (q >= 0) {
    u = u.slice(0, q)
  }
  return u
}

export default function SeedUnlockPanel(props) {
  let src = ''
  let subtitles = []
  let playing = false
  try {
    src = str(props.src)
  } catch (e) {
    src = ''
  }
  try {
    if (props.subtitles) {
      subtitles = props.subtitles
    }
  } catch (e2) {
    subtitles = []
  }
  try {
    if (props.playing === true) {
      playing = true
    }
  } catch (e3) {}

  if (src.length === 0) {
    return (
      <div className="fb-media fb-media-empty">
        <p className="fb-media-msg">No media path for this title yet.</p>
      </div>
    )
  }

  const logical = logicalFromSrc(src)
  let cid = resolveMediaCid(logical)
  const probe = statusUrl(src)
  const resp = fetch(probe, { method: 'GET' })
  const st = parseStatus(resp)
  if (!looksLikeCid(cid) && looksLikeCid(st.cid)) {
    cid = str(st.cid).trim()
  }

  if (st.ok) {
    let tracks = []
    let ti = 0
    while (ti < subtitles.length) {
      const t = subtitles[ti]
      if (t && t.src) {
        tracks = tracks.concat([
          <track
            key={'sub-' + ti}
            kind="subtitles"
            src={str(t.src)}
            srcLang={str(t.lang) || 'en'}
            label={str(t.label) || 'Subtitles'}
            default={t.default === true}
          />,
        ])
      }
      ti = ti + 1
    }
    return (
      <div className="fb-media fb-media-ready" data-relay-media="ready">
        <video
          className="fb-media-video"
          controls={true}
          playsInline={true}
          src={src}
          autoPlay={playing === true}
        >
          {tracks}
        </video>
      </div>
    )
  }

  const pct = st.progressPct
  return (
    <div
      className="fb-media fb-media-pending"
      data-relay-media="pending"
      data-seed-state={st.seedState}
      data-error={st.error}
    >
      <p className="fb-media-msg">{statusLabel(st)}</p>
      <p className="fb-media-hint">
        The content hash is known. Until a peer seeds the bytes onto IPFS, playback cannot start.
      </p>
      {pct !== null ? (
        <div className="fb-media-bar">
          <div className="fb-media-bar-fill" style={{ width: pct + '%' }} />
        </div>
      ) : null}
      <IpfsInspectRow cid={cid} providers={st.providers} />
    </div>
  )
}
