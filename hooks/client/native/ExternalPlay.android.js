/**
 * Android CleverScript host for ExternalPlay.
 * Opens HTTPS MKV via intent ACTION_VIEW (system chooser / VLC). No vlc://.
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
      return origin + '/' + h
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

export default function ExternalPlay(props) {
  const p = props || {}
  const abs = absoluteHref(propStr(p, 'streamUrl'))
  let unlocked = false
  try {
    if (p.unlocked === true || propStr(p, 'unlocked') === 'true') {
      unlocked = true
    }
  } catch (e) {}
  const setupHref = propStr(p, 'setupHref') || '/setup'

  if (abs.length === 0) {
    return (
      <div className="fb-external-play" data-fb-external-play="1">
        <p className="fb-theater-downloads-note">No stream URL for this title yet.</p>
      </div>
    )
  }

  if (unlocked !== true) {
    return (
      <div className="fb-external-play fb-theater-external" data-fb-external-play="1">
        <p className="fb-theater-downloads-label">Watch in an external player</p>
        <p className="fb-theater-downloads-note">
          Confirm you own a legal copy above, then open the stream in VLC or another player.
        </p>
        <code className="fb-theater-external-url">{abs}</code>
      </div>
    )
  }

  const intentHref = intentHrefFor(abs)
  return (
    <div
      className="fb-external-play fb-theater-external"
      data-fb-external-play="1"
      data-playback-engine="external"
    >
      <p className="fb-theater-downloads-label">Or watch in another app</p>
      <p className="fb-theater-downloads-note">
        Use this if in-app play fails, or you prefer VLC. Android will ask which app should open the
        stream — pick VLC and optionally Always.
      </p>
      <code className="fb-theater-external-url">{abs}</code>
      <div className="fb-external-play-actions fb-theater-external-actions">
        <a className="fb-btn fb-btn-primary fb-btn-external-play fb-theater-open-intent" href={intentHref}>
          Open in external player
        </a>
        <a className="fb-btn fb-theater-download-mkv" href={abs} download="">
          Download MKV
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
