/**
 * SSR-safe media unlock panel: native <video> when Relay has bytes,
 * otherwise seed message + IpfsInspectRow (CID from stub/status).
 * Avoids @clevertree/video — that import drops the whole RelayMedia tree from SSR.
 */
import React from 'react'
import IpfsInspectRow, { looksLikeCid, resolveMediaCid } from 'hooks/client/components/IpfsInspect.jsx'

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
