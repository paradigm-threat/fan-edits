/**
 * Android CleverScript host for TheaterPlayer.
 * In-app Media3 (HW HEVC MKV) plus ExternalPlay escape hatch and downloads.
 */
import React, { useState } from 'react'
import { VideoPlayer } from '@clevertree/video'
import ExternalPlay from 'hooks/client/native/ExternalPlay.js'

function propStr(p, key) {
  try {
    if (p && p[key] !== null && p[key] !== undefined) {
      return '' + p[key]
    }
  } catch (e) {}
  return ''
}

function propBool(p, key) {
  try {
    if (p && p[key] === true) {
      return true
    }
    if (propStr(p, key) === 'true') {
      return true
    }
  } catch (e2) {}
  return false
}

/** Prefer archival master MKV. */
function androidSrcLadder(p) {
  const mobile = propStr(p, 'srcMobile')
  const web = propStr(p, 'srcWeb')
  const master = propStr(p, 'srcMaster')
  const fallback = propStr(p, 'src')
  let out = []
  if (master.length > 0) {
    out = out.concat([master])
  }
  if (web.length > 0) {
    out = out.concat([web])
  }
  if (mobile.length > 0) {
    out = out.concat([mobile])
  }
  if (out.length === 0 && fallback.length > 0) {
    out = out.concat([fallback])
  }
  let uniq = []
  for (let i = 0; i < out.length; i++) {
    let seen = false
    for (let j = 0; j < uniq.length; j++) {
      if (uniq[j] === out[i]) {
        seen = true
      }
    }
    if (!seen) {
      uniq = uniq.concat([out[i]])
    }
  }
  return uniq
}

function probeSeed(src) {
  try {
    const statusUrl = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'relayAssetStatus=1'
    const res = fetch(statusUrl)
    if (res && res.text) {
      const j = JSON.parse(res.text)
      if (j && j.error && j.error !== 'ok') {
        return { ok: false, message: j.message || 'This file needs to be seeded' }
      }
    }
    return { ok: true, message: '' }
  } catch (e) {
    return { ok: false, message: 'This file needs to be seeded' }
  }
}

function pickSeededSrc(ladder) {
  if (!ladder || ladder.length === 0) {
    return { src: '', message: 'No media path for this title.' }
  }
  let lastMsg = 'This movie isn’t ready to stream yet.'
  for (let i = 0; i < ladder.length; i++) {
    const r = probeSeed(ladder[i])
    if (r.ok) {
      return { src: ladder[i], message: '' }
    }
    lastMsg = r.message || lastMsg
  }
  return { src: '', message: lastMsg }
}

function downloadLinks(p) {
  const master = propStr(p, 'srcMaster') || propStr(p, 'src')
  const web = propStr(p, 'srcWeb')
  const mobile = propStr(p, 'srcMobile')
  let dl = []
  if (master.length > 0) {
    dl = dl.concat([{ label: 'Full quality (MKV)', href: master }])
  }
  if (web.length > 0 && web !== master) {
    dl = dl.concat([{ label: '1080p (MP4)', href: web }])
  }
  if (mobile.length > 0 && mobile !== master && mobile !== web) {
    dl = dl.concat([{ label: '720p (MP4)', href: mobile }])
  }
  let links = []
  for (let i = 0; i < dl.length; i++) {
    links = links.concat([
      <a href={dl[i].href} download="">
        {dl[i].label}
      </a>,
    ])
  }
  return (
    <div className="fb-theater-downloads" data-fb-downloads="1">
      <p className="fb-theater-downloads-label">Download the movie</p>
      <div className="fb-theater-downloads-links">{links}</div>
      <p className="fb-theater-downloads-note">
        Play in the app when you can. Download for offline, or open in VLC if this device cannot decode HEVC.
      </p>
    </div>
  )
}

export default function TheaterPlayer(props) {
  const p = props || {}
  const ladder = androidSrcLadder(p)
  const seedState = useState('idle')
  const seed = seedState[0]
  const setSeed = seedState[1]
  const srcState = useState('')
  const chosenSrc = srcState[0]
  const setChosenSrc = srcState[1]
  const errState = useState('')
  const playError = errState[0]
  const setPlayError = errState[1]

  if (p.unlocked !== true) {
    return (
      <div className="fb-theater-locked">
        <p>Confirm you own a legal copy to play this edit.</p>
      </div>
    )
  }
  if (ladder.length === 0) {
    return <p>No media path for this title.</p>
  }
  if (seed === 'idle') {
    const pick = pickSeededSrc(ladder)
    if (pick.src.length > 0) {
      setChosenSrc(pick.src)
      setSeed('ready')
    } else {
      setChosenSrc('')
      setSeed(pick.message || 'This movie isn’t ready to stream yet.')
    }
  }
  if (seed !== 'ready') {
    return (
      <div className="fb-theater-player">
        <div className="fb-theater-seed">
          <p>
            {seed === 'idle'
              ? 'Getting the movie ready…'
              : 'Sorry — we couldn’t prepare this stream yet.'}
          </p>
          <p>You can download the movie below and open it on your device.</p>
          <button
            type="button"
            onClick={() => {
              setSeed('idle')
            }}
          >
            Try again
          </button>
        </div>
        {downloadLinks(p)}
      </div>
    )
  }

  let playing = false
  if (propBool(p, 'playing') === true) {
    playing = true
  }
  let command = 0
  try {
    if (p.command !== null && p.command !== undefined) {
      command = p.command
    }
  } catch (eCmd) {}
  let commandSeq = 0
  try {
    if (p.commandSeq !== null && p.commandSeq !== undefined) {
      commandSeq = p.commandSeq
    }
  } catch (eSeq) {}
  let startAt = 0
  try {
    const raw = propStr(p, 'startAt')
    if (raw.length > 0) {
      startAt = parseFloat(raw)
    }
  } catch (eStart) {}

  return (
    <div className="fb-theater-player" data-playback-engine="native">
      <div className="fb-theater-native-player">
        <VideoPlayer
          src={chosenSrc}
          controls={true}
          playing={playing}
          command={command}
          commandSeq={commandSeq}
          currentTime={startAt}
          className="fb-relay-video"
          onError={() => {
            setPlayError(
              'This device could not play the movie in the app (often missing HEVC hardware). Use Open in external player below — VLC usually works.',
            )
          }}
        />
      </div>
      {playError.length > 0 ? (
        <p className="fb-theater-play-error">{playError}</p>
      ) : (
        <p className="fb-theater-downloads-note">
          Full-quality HEVC MKV streams in this app when your device has hardware decode. Prefer
          Open in external player if playback fails.
        </p>
      )}
      <ExternalPlay streamUrl={chosenSrc} unlocked={true} setupHref="/setup" />
      {downloadLinks(p)}
      {p.cid ? <p className="fb-theater-tech-body">CID {p.cid}</p> : null}
    </div>
  )
}
