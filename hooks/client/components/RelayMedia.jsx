/**
 * Optional VideoPlayer-based media wrapper.
 * Parked flashback pages use SeedUnlockPanel instead — @clevertree/video
 * import drops this tree from CleverScript SSR.
 */
import React, { useState } from 'react'
import { VideoPlayer } from '@clevertree/video'
import { isClientLive } from '@clevertree/style-internal'

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
  } catch (e) {
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

export default function RelayMedia(props) {
  let src = ''
  let subtitles = []
  let playing = false
  let command = 0
  let commandSeq = 0
  let onPlay = null
  let onPause = null
  try {
    src = str(props.src)
  } catch (e) {
    src = ''
  }
  try {
    if (props.subtitles) {
      subtitles = props.subtitles
    }
  } catch (e) {
    subtitles = []
  }
  try {
    if (props.playing === true) {
      playing = true
    }
  } catch (e) {}
  try {
    if (typeof props.command === 'number') {
      command = props.command
    }
  } catch (e) {}
  try {
    if (typeof props.commandSeq === 'number') {
      commandSeq = props.commandSeq
    }
  } catch (e) {}
  try {
    onPlay = props.onPlay
  } catch (e) {}
  try {
    onPause = props.onPause
  } catch (e) {}

  const attemptState = useState(0)
  const attempt = attemptState[0]
  const setAttempt = attemptState[1]
  const schedState = useState(-1)
  const scheduledFor = schedState[0]
  const setScheduledFor = schedState[1]
  const live = isClientLive() === true

  if (src.length === 0) {
    return (
      <div className="fb-media fb-media-empty">
        <p className="fb-media-msg">No media path for this title yet.</p>
      </div>
    )
  }

  const probe = statusUrl(src)
  const resp = fetch(probe, { method: 'GET' })
  const st = parseStatus(resp)
  const cid = looksLikeCid(st.cid) ? str(st.cid).trim() : ''

  if (st.ok) {
    return (
      <div className="fb-media fb-media-ready" data-relay-media="ready">
        <VideoPlayer
          src={src}
          controls={true}
          playing={playing}
          command={command}
          commandSeq={commandSeq}
          subtitles={subtitles}
          onPlay={onPlay}
          onPause={onPause}
        />
      </div>
    )
  }

  const exhausted = attempt >= 36
  const permanent = st.retryable !== true && (st.error === 'ipfs-not-found' || st.seedState === 'unavailable')
  if (exhausted || permanent) {
    return (
      <div className="fb-media fb-media-failed" data-relay-media="failed" data-error={st.error}>
        <p className="fb-media-msg">{statusLabel(st)}</p>
        <p className="fb-media-hint">
          The content hash is known. Until a peer seeds the bytes onto IPFS, playback cannot start.
        </p>
        {cid ? <p className="fb-media-cid">{cid}</p> : null}
        <button
          type="button"
          className="fb-btn"
          onClick={() => {
            setScheduledFor(-1)
            setAttempt(0)
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (live && st.retryable === true && scheduledFor !== attempt) {
    let delay = st.retryAfterSecs > 0 ? st.retryAfterSecs * 1000 : 2500
    if (delay < 2000) {
      delay = 2000
    }
    if (delay > 15000) {
      delay = 15000
    }
    setScheduledFor(attempt)
    try {
      if (typeof globalThis !== 'undefined' && globalThis.setTimeout) {
        globalThis.setTimeout(() => {
          setAttempt(attempt + 1)
        }, delay)
      }
    } catch (e) {}
  }

  const pct = st.progressPct
  return (
    <div className="fb-media fb-media-pending" data-relay-media="pending" data-seed-state={st.seedState}>
      <p className="fb-media-msg">{statusLabel(st)}</p>
      {pct !== null ? (
        <div className="fb-media-bar">
          <div className="fb-media-bar-fill" style={{ width: pct + '%' }} />
        </div>
      ) : null}
    </div>
  )
}
