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
  let bytesTotal = null
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
  try {
    if (typeof props.bytesTotal === 'number') {
      bytesTotal = props.bytesTotal
    }
  } catch (eBytes) {}
  if (!looksLikeCid(cid)) {
    return null
  }
  const enc = encodeCid(cid)
  const inspector = 'https://cid.ipfs.tech/#' + cid
  const check = 'https://check.ipfs.network/?cid=' + enc
  const gatewayIo = 'https://ipfs.io/ipfs/' + enc
  const gatewayDweb = 'https://dweb.link/ipfs/' + enc
  let noteParts = []
  if (typeof bytesTotal === 'number' && bytesTotal > 0) {
    noteParts = noteParts.concat(['Reported size ' + formatBytes(bytesTotal)])
  }
  if (providers !== null) {
    if (providers === 0) {
      noteParts = noteParts.concat(['0 providers'])
    } else if (providers === 1) {
      noteParts = noteParts.concat(['1 provider'])
    } else {
      noteParts = noteParts.concat([providers + ' providers'])
    }
  }
  const providerNote = noteParts.length > 0 ? noteParts.join(' · ') : ''
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
      bytesTotal: typeof seed.bytesTotal === 'number' ? seed.bytesTotal : null,
      bytesReceived: typeof seed.bytesReceived === 'number' ? seed.bytesReceived : null,
      cid: typeof data.cid === 'string' ? data.cid : '',
    }
  } catch (e2) {
    return empty
  }
}

function formatBytes(n) {
  if (typeof n !== 'number' || !(n >= 0)) {
    return ''
  }
  if (n < 1000) {
    return n + ' B'
  }
  if (n < 1000000) {
    return (n / 1000).toFixed(1) + ' KB'
  }
  if (n < 1000000000) {
    return (n / 1000000).toFixed(1) + ' MB'
  }
  return (n / 1000000000).toFixed(2) + ' GB'
}

function displayPct(st) {
  if (!st) {
    return 0
  }
  if (typeof st.progressPct === 'number') {
    let p = st.progressPct
    if (p < 0) {
      p = 0
    }
    if (p > 100) {
      p = 100
    }
    return p
  }
  return 0
}

function isStubCid(st) {
  return !!(st && typeof st.bytesTotal === 'number' && st.bytesTotal > 0 && st.bytesTotal < 100000)
}

function statusHint(st) {
  if (isStubCid(st)) {
    return (
      'This content hash points at ' +
      formatBytes(st.bytesTotal) +
      ' (a filesystem symlink path), not multi‑GB video bytes. Local re-ingest must follow the symlink, then republish the stub.'
    )
  }
  if (st && st.seedState === 'fetching') {
    return 'Gateway is pulling blocks from IPFS peers…'
  }
  if (st && typeof st.providers === 'number' && st.providers === 0) {
    return 'No peer currently advertises this CID. Seeding is stalled until a node pins and announces it.'
  }
  return 'The content hash is known. Until a peer seeds the bytes onto IPFS, playback cannot start.'
}

function statusLabel(st) {
  if (st.ok) {
    return 'Ready'
  }
  const pct = displayPct(st)
  let prov = null
  if (typeof st.providers === 'number') {
    if (st.providers === 1) {
      prov = '1 provider'
    } else {
      prov = st.providers + ' providers'
    }
  }
  if (isStubCid(st)) {
    return (
      'Broken CID — only ' +
      formatBytes(st.bytesTotal) +
      ' (symlink stub, not the video). Re-ingest required.'
    )
  }
  if (st.seedState === 'fetching') {
    let line = 'Seeding… ' + pct + '%'
    if (typeof st.bytesReceived === 'number' && typeof st.bytesTotal === 'number' && st.bytesTotal > 0) {
      line = line + ' · ' + formatBytes(st.bytesReceived) + ' / ' + formatBytes(st.bytesTotal)
    }
    if (prov) {
      line = line + ' · ' + prov
    }
    return line
  }
  if (st.seedState === 'unavailable' || st.error === 'ipfs-not-found') {
    return 'Needs seed · ' + pct + '%' + (prov ? ' · ' + prov : ' · 0 providers')
  }
  if (st.seedState === 'missing' || st.error === 'ipfs-pending') {
    return 'Waiting for seed · ' + pct + '%' + (prov ? ' · ' + prov : '') + ' — retrying…'
  }
  if (st.error === 'ipfs-busy') {
    return 'Busy · ' + pct + '% — retrying…'
  }
  if (st.error === 'ipfs-gateway-timeout') {
    return 'Gateway timeout · ' + pct + '% — retrying…'
  }
  if (st.message) {
    return st.message + ' · ' + pct + '%'
  }
  return 'Needs seed · ' + pct + '%'
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

  if (st.ok && !isStubCid(st)) {
    // CleverScript cannot parse JSX attr name `default` (reserved). Prefer default
    // tracks first; browsers treat the first <track> as the usual pick without `default`.
    let tracks = []
    let rest = []
    let ti = 0
    while (ti < subtitles.length) {
      const t = subtitles[ti]
      if (t && t.src) {
        const el = (
          <track
            key={'sub-' + ti}
            kind="subtitles"
            src={str(t.src)}
            srcLang={str(t.lang) || 'en'}
            label={str(t.label) || 'Subtitles'}
          />
        )
        let isDef = false
        try {
          if (t.default === true) {
            isDef = true
          }
        } catch (eDef) {}
        if (isDef) {
          tracks = tracks.concat([el])
        } else {
          rest = rest.concat([el])
        }
      }
      ti = ti + 1
    }
    tracks = tracks.concat(rest)
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

  const pct = displayPct(st)
  const failed = isStubCid(st)
  return (
    <div
      className={failed ? 'fb-media fb-media-failed' : 'fb-media fb-media-pending'}
      data-relay-media={failed ? 'failed' : 'pending'}
      data-seed-state={st.seedState}
      data-error={st.error}
    >
      <p className="fb-media-msg">{statusLabel(st)}</p>
      <p className="fb-media-hint">{statusHint(st)}</p>
      <div
        className="fb-media-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        title={pct + '%'}
      >
        <div className="fb-media-bar-fill" style={{ width: pct + '%' }} />
      </div>
      <IpfsInspectRow cid={cid} providers={st.providers} bytesTotal={st.bytesTotal} />
    </div>
  )
}
