/**
 * Android CleverScript host for ExternalPlay.
 * Opens HTTPS media via intent ACTION_VIEW (system chooser / VLC). No vlc://.
 */
import React, { useState } from 'react'

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
  push('master', 'Full quality (MKV)', master)
  push('web', '1080p (H.264)', web)
  push('mobile', '720p (H.264)', mobile)
  return out
}

export default function ExternalPlay(props) {
  const p = props || {}
  const ladder = buildLadder(p)
  const idxState = useState(0)
  const activeIndex = idxState[0]
  const setActiveIndex = idxState[1]
  let unlocked = false
  try {
    if (p.unlocked === true || propStr(p, 'unlocked') === 'true') {
      unlocked = true
    }
  } catch (e) {}
  const setupHref = propStr(p, 'setupHref') || '/setup'

  if (ladder.length === 0) {
    return (
      <div className="fb-external-play" data-fb-external-play="1">
        <p className="fb-theater-downloads-note">No stream URL for this title yet.</p>
      </div>
    )
  }

  const active = ladder[activeIndex] || ladder[0]
  const abs = active.url
  const intentHref = intentHrefFor(abs)
  const dlLabel = active.kind === 'master' ? 'Download MKV' : 'Download MP4'

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
      <div>
        <p className="fb-theater-downloads-label">Quality</p>
        <p className="fb-theater-downloads-note">
          Full quality needs HEVC. Pick 1080p or 720p if the master will not play on this device.
        </p>
        <div className="fb-external-play-quality" role="radiogroup" aria-label="Stream quality">
          {buttons}
        </div>
      </div>
    )
  }

  if (unlocked !== true) {
    return (
      <div className="fb-external-play fb-theater-external" data-fb-external-play="1">
        <p className="fb-theater-downloads-label">Watch in an external player</p>
        {qualityRow}
        <p className="fb-theater-downloads-note">
          Confirm you own a legal copy above, then open the stream in VLC or another player.
        </p>
        <a className="fb-theater-external-url" href={abs} data-fb-stream-url="1" rel="noopener noreferrer">
          {abs}
        </a>
      </div>
    )
  }

  return (
    <div
      className="fb-external-play fb-theater-external"
      data-fb-external-play="1"
      data-playback-engine="external"
    >
      <p className="fb-theater-downloads-label">Watch in an external player</p>
      {qualityRow}
      <p className="fb-theater-downloads-note">
        Full-quality HEVC MKV streams best in VLC when this device has HEVC hardware. Use 1080p
        H.264 on older Fire TV / phones. Tap below to open the selected stream.
      </p>
      <a className="fb-theater-external-url" href={abs} data-fb-stream-url="1" rel="noopener noreferrer">
        {abs}
      </a>
      <div className="fb-external-play-actions fb-theater-external-actions">
        <a className="fb-btn fb-btn-primary fb-btn-external-play fb-theater-open-intent" href={intentHref}>
          Open in external player
        </a>
        <a className="fb-btn fb-theater-open-https" href={abs} rel="noopener noreferrer">
          Open stream link
        </a>
        <a className="fb-btn fb-theater-download-mkv" href={abs} download="">
          {dlLabel}
        </a>
        <a className="fb-btn fb-btn-setup" href={setupHref}>
          Setup
        </a>
        <a
          className="fb-btn fb-theater-get-vlc"
          href="https://play.google.com/store/apps/details?id=org.videolan.vlc"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get VLC (Play Store)
        </a>
      </div>
    </div>
  )
}
