/**
 * Per-title ownership reaffirm — native form + checkbox + OK (CleverScript-safe).
 *
 * Same pattern as OwnershipGate: GET ?movieOwnAck=<slug> persists via injected
 * script / client consume; no reliance on hydrated onClick.
 */
import React from 'react'

var PREFIX = 'flashback.movieOwn.v1.'
var WELCOME_KEY = 'flashback.ownershipAck.v1'

function str(v) {
  if (v === null) {
    return ''
  }
  if (typeof v === 'undefined') {
    return ''
  }
  if (typeof v === 'string') {
    return v
  }
  return '' + v
}

function ackKey(slug) {
  return PREFIX + str(slug)
}

function readWelcomeAck() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
      return false
    }
    if (!globalThis.localStorage.getItem) {
      return false
    }
    return globalThis.localStorage.getItem(WELCOME_KEY) === '1'
  } catch (e) {
    return false
  }
}

function writeWelcomeAck() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
      return
    }
    if (!globalThis.localStorage.setItem) {
      return
    }
    globalThis.localStorage.setItem(WELCOME_KEY, '1')
  } catch (e) {}
}

export function hasMovieOwnAck(slug) {
  try {
    let s = str(slug)
    if (s.length === 0) {
      return false
    }
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
      return false
    }
    if (!globalThis.localStorage.getItem) {
      return false
    }
    return globalThis.localStorage.getItem(ackKey(s)) === '1'
  } catch (e) {
    return false
  }
}

function writeMovieOwnAck(slug) {
  try {
    let s = str(slug)
    if (s.length === 0) {
      return
    }
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
      return
    }
    if (!globalThis.localStorage.setItem) {
      return
    }
    globalThis.localStorage.setItem(ackKey(s), '1')
  } catch (e) {}
}

function searchParamValue(name) {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.location) {
      return ''
    }
    let search = '' + (globalThis.location.search || '')
    let key = name + '='
    let idx = search.indexOf(key)
    if (idx < 0) {
      return ''
    }
    let rest = search.slice(idx + key.length)
    let amp = rest.indexOf('&')
    if (amp >= 0) {
      rest = rest.slice(0, amp)
    }
    return rest
  } catch (e) {
    return ''
  }
}

function searchHasMovieOwnAck(slug) {
  let want = str(slug)
  if (want.length === 0) {
    return false
  }
  let got = searchParamValue('movieOwnAck')
  if (got.length === 0) {
    return false
  }
  // Decode + to space if browser encoded; slug itself has no spaces
  if (got === want) {
    return true
  }
  try {
    if (typeof globalThis !== 'undefined' && globalThis.decodeURIComponent) {
      if (globalThis.decodeURIComponent(got) === want) {
        return true
      }
    }
  } catch (e) {}
  return false
}

function searchHasOwnershipAck() {
  let search = ''
  try {
    if (typeof globalThis !== 'undefined' && globalThis.location) {
      search = '' + (globalThis.location.search || '')
    }
  } catch (e) {}
  if (search.indexOf('ownershipAck=1') >= 0) {
    return true
  }
  return false
}

function stripAckQuery(slug) {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.history || !globalThis.history.replaceState) {
      return
    }
    let path = '/' + str(slug)
    try {
      if (globalThis.location && globalThis.location.pathname) {
        path = '' + globalThis.location.pathname
      }
    } catch (e2) {}
    globalThis.history.replaceState(null, '', path)
  } catch (e3) {}
}

function hideMovieAckNode() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.document) {
      return
    }
    let doc = globalThis.document
    if (!doc.querySelector) {
      return
    }
    let el = doc.querySelector('.fb-movie-ack')
    if (!el) {
      return
    }
    // Hide instead of remove — removing before/during hydrate breaks soft-hydrate handlers.
    try {
      if (el.style) {
        el.style.display = 'none'
      }
    } catch (eH) {}
    try {
      if (el.setAttribute) {
        el.setAttribute('aria-hidden', 'true')
      }
    } catch (eA) {}
  } catch (e) {}
}

function hideWelcomeGateNode() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.document) {
      return
    }
    let doc = globalThis.document
    if (!doc.querySelector) {
      return
    }
    let gate = doc.querySelector('.fb-gate')
    if (!gate) {
      return
    }
    try {
      if (gate.style) {
        gate.style.display = 'none'
      }
    } catch (eH) {}
    try {
      if (gate.setAttribute) {
        gate.setAttribute('aria-hidden', 'true')
      }
    } catch (eA) {}
  } catch (e) {}
}

/**
 * Persist ?movieOwnAck=<slug> (+ optional ownershipAck=1) and strip overlay nodes.
 * Returns true when this slug is acknowledged.
 */
export function ensureMovieOwnAckFromBrowser(slug) {
  let s = str(slug)
  let fromQuery = searchHasMovieOwnAck(s)
  if (fromQuery === true) {
    writeMovieOwnAck(s)
    if (searchHasOwnershipAck() === true) {
      writeWelcomeAck()
      hideWelcomeGateNode()
    }
    stripAckQuery(s)
    hideMovieAckNode()
  }
  if (hasMovieOwnAck(s) === true) {
    hideMovieAckNode()
    return true
  }
  return false
}

/**
 * Strip fanedit/edition suffix from a display title (UI fallback only).
 * Prefer props.originalTitle from index.json when present.
 */
function stripEditionSuffix(raw) {
  let t = str(raw).trim()
  if (t.length === 0) {
    return ''
  }
  let em = t.indexOf(' — ')
  let hy = t.indexOf(' - ')
  let cut = -1
  if (em >= 0 && hy >= 0) {
    if (em < hy) {
      cut = em
    } else {
      cut = hy
    }
  } else if (em >= 0) {
    cut = em
  } else if (hy >= 0) {
    cut = hy
  }
  if (cut >= 0) {
    t = t.slice(0, cut).trim()
  }
  return t
}

/**
 * Overlay CTA until the viewer confirms they own this particular title.
 * props.slug, props.originalTitle, props.title (fallback), props.needWelcome, props.onAck
 */
export default function MovieOwnAck(props) {
  let slug = ''
  let originalTitle = ''
  let title = ''
  let needWelcome = false
  try {
    if (props && props.slug) {
      slug = str(props.slug)
    }
  } catch (e) {}
  try {
    if (props && props.originalTitle) {
      originalTitle = str(props.originalTitle)
    }
  } catch (e1) {}
  try {
    if (props && props.title) {
      title = str(props.title)
    }
  } catch (e2) {}
  try {
    if (props && props.needWelcome === true) {
      needWelcome = true
    }
  } catch (e3) {}

  if (readWelcomeAck() === true) {
    needWelcome = false
  }

  let fromQuery = ensureMovieOwnAckFromBrowser(slug)
  if (fromQuery === true || hasMovieOwnAck(slug) === true) {
    return null
  }

  let ownName = originalTitle
  if (ownName.length === 0) {
    ownName = stripEditionSuffix(title)
  }
  if (ownName.length === 0) {
    ownName = 'this movie'
  }

  let action = '/' + slug
  let checkLabel = 'I confirm I own a legal copy of ' + ownName + '.'

  return (
    <div className="fb-movie-ack" role="dialog" aria-label="Confirm you own this title">
      <div className="fb-movie-ack-card">
        <p className="fb-movie-ack-kicker">Before you play</p>
        <h2 className="fb-movie-ack-title">{"Own the original — then enjoy the edit"}</h2>
        <p className="fb-movie-ack-body">
          {"Check the box and tap OK to unlock playback for this title. Same house rule as the welcome screen: the edit is for people who already have the movie."}
        </p>
        <form className="fb-movie-ack-form" method="get" action={action}>
          <input type="hidden" name="movieOwnAck" value={slug} />
          {needWelcome === true ? (
            <input type="hidden" name="ownershipAck" value="1" />
          ) : null}
          <label className="fb-movie-ack-check">
            <input
              type="checkbox"
              className="fb-movie-ack-checkbox"
              name="confirm"
              value="1"
              required
            />
            <span>{checkLabel}</span>
          </label>
          <p className="fb-movie-ack-hint">
            {"Check the box above, then tap OK to continue."}
          </p>
          <div className="fb-movie-ack-actions">
            <button type="submit" className="fb-btn fb-btn-primary fb-movie-ack-ok">
              OK — I confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
