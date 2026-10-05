/**
 * Per-title ownership reaffirm — one friendly sentence, stored forever per slug.
 */
import React, { useState } from 'react'

var PREFIX = 'flashback.movieOwn.v1.'

function ackKey(slug) {
  return PREFIX + (slug || '')
}

export function hasMovieOwnAck(slug) {
  try {
    if (!slug) {
      return false
    }
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
      return false
    }
    if (!globalThis.localStorage.getItem) {
      return false
    }
    return globalThis.localStorage.getItem(ackKey(slug)) === '1'
  } catch (e) {
    return false
  }
}

function writeMovieOwnAck(slug) {
  try {
    if (!slug) {
      return
    }
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
      return
    }
    if (!globalThis.localStorage.setItem) {
      return
    }
    globalThis.localStorage.setItem(ackKey(slug), '1')
  } catch (e) {}
}

/**
 * Overlay CTA until the viewer confirms they own this particular title.
 * props.slug, props.title, props.onAck
 */
export default function MovieOwnAck(props) {
  let slug = ''
  let title = 'this movie'
  try {
    if (props && props.slug) {
      slug = '' + props.slug
    }
  } catch (e) {}
  try {
    if (props && props.title) {
      title = '' + props.title
    }
  } catch (e) {}

  const doneState = useState(hasMovieOwnAck(slug))
  const done = doneState[0]
  const setDone = doneState[1]

  if (done === true) {
    return null
  }

  return (
    <div className="fb-movie-ack" role="dialog" aria-label="Confirm you own this title">
      <div className="fb-movie-ack-card">
        <label className="fb-movie-ack-check">
          <input
            type="checkbox"
            onChange={(e) => {
              let on = false
              try {
                on = e && e.target && e.target.checked === true
              } catch (err) {
                on = false
              }
              if (on !== true) {
                return
              }
              writeMovieOwnAck(slug)
              setDone(true)
              try {
                if (props && typeof props.onAck === 'function') {
                  props.onAck()
                }
              } catch (e2) {}
            }}
          />
          <span>I already read the disclaimer, and I own {title}.</span>
        </label>
      </div>
    </div>
  )
}
