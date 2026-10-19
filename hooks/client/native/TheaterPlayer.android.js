/**
 * Android CleverScript host for TheaterPlayer.
 * External CTA lives in ExternalPlay.android.js (intent VIEW). Downloads stay here.
 */
import React, { useState } from 'react'
import ExternalPlay from 'hooks/client/native/ExternalPlay.js'

function propStr(p, key) {
  try {
    if (p && p[key] !== null && p[key] !== undefined) {
      return '' + p[key]
    }
  } catch (e) {}
  return ''
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
    dl = dl.concat([{ label: 'HEVC MKV', href: master }])
  }
  if (web.length > 0) {
    dl = dl.concat([{ label: '1080p HEVC', href: web }])
  }
  if (mobile.length > 0) {
    dl = dl.concat([{ label: '720p HEVC', href: mobile }])
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
        Prefer Open in external player above. Download for offline, then open in VLC.
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
  return (
    <div className="fb-theater-player" data-playback-engine="external">
      <ExternalPlay
        streamUrl={chosenSrc}
        status="showing"
        unlocked={true}
        setupHref="/setup"
      />
      {downloadLinks(p)}
      {p.cid ? <p className="fb-theater-tech-body">CID {p.cid}</p> : null}
    </div>
  )
}
