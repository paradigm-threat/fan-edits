/**
 * First-visit ownership acknowledgment — must confirm before browsing/playing.
 *
 * CleverScript / park notes:
 * - Hydrated onClick is unreliable (SSR gate can resurrect; hid handlers flake).
 * - Use a native GET form + required checkbox so confirm works even without JS.
 * - On return with ?ownershipAck=1, persist to localStorage; React unmounts once live.
 */
import React from 'react'

var ACK_KEY = 'flashback.ownershipAck.v1'

function readAckFromDocFlag() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.document && globalThis.document.documentElement) {
      if (globalThis.document.documentElement.getAttribute('data-fb-welcome-ack') === '1') {
        return true
      }
    }
  } catch (e) {}
  return false
}

function readAckFromHostBridge() {
  if (readAckFromDocFlag() === true) {
    return true
  }
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__fbHasWelcome) {
      if (globalThis.__fbHasWelcome() === true) {
        return true
      }
    }
  } catch (e) {}
  return false
}

function readAck() {
  if (readAckFromHostBridge() === true) {
    return true
  }
  try {
    if (typeof localStorage === 'undefined') {
      return false
    }
    if (!localStorage.getItem) {
      return false
    }
    return localStorage.getItem(ACK_KEY) === '1'
  } catch (e) {
    return false
  }
}

function writeAck() {
  try {
    if (typeof localStorage === 'undefined') {
      return
    }
    if (!localStorage.setItem) {
      return
    }
    localStorage.setItem(ACK_KEY, '1')
  } catch (e) {}
}

function searchHasOwnershipAck() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.location) {
      return false
    }
    let search = '' + (globalThis.location.search || '')
    if (search.indexOf('ownershipAck=1') >= 0) {
      return true
    }
  } catch (e) {}
  return false
}

function consumeAckQuery() {
  if (searchHasOwnershipAck() !== true) {
    return false
  }
  writeAck()
  try {
    if (typeof globalThis !== 'undefined' && globalThis.history && globalThis.history.replaceState) {
      let path = '/'
      try {
        if (globalThis.location && globalThis.location.pathname) {
          path = '' + globalThis.location.pathname
        }
      } catch (e2) {}
      globalThis.history.replaceState(null, '', path)
    }
  } catch (e3) {}
  return true
}

export function hasOwnershipAck() {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.__fbHasWelcome === 'function') {
      if (globalThis.__fbHasWelcome() === true) {
        return true
      }
    }
  } catch (eHost) {}
  if (readAck() === true) {
    return true
  }
  if (searchHasOwnershipAck() === true) {
    return true
  }
  return false
}

/**
 * Call from the root client hook on every render. Persists ?ownershipAck=1.
 * Do not mutate gate DOM — soft-hydrate freezes if vnode and DOM diverge.
 */
export function ensureOwnershipAckFromBrowser() {
  let fromQuery = consumeAckQuery()
  if (readAck() === true || fromQuery === true) {
    return true
  }
  return false
}

export default function OwnershipGate(props) {
  // Parent decides when to mount; always render the form when mounted.
  consumeAckQuery()

  return (
    <div className="fb-gate" role="dialog" aria-modal="true" aria-labelledby="fb-gate-title">
      <div className="fb-gate-card">
        <p className="fb-gate-kicker">Welcome</p>
        <h2 id="fb-gate-title" className="fb-gate-title">
          {"Own the original — then enjoy the edit"}
        </h2>
        <p className="fb-gate-body">
          {"Before you play any fan edit here, please confirm you own a legal commercial copy of the corresponding original film. Same house rule fanedit communities have used for years: the edit is for people who already have the movie."}
        </p>
        <p className="fb-gate-body">
          {"This site is a personal catalog of projects — not a pirate archive, and not a substitute for buying or renting the studio release."}
        </p>
        <form className="fb-gate-form" method="get" action="/">
          <input type="hidden" name="ownershipAck" value="1" />
          <label className="fb-gate-check">
            <input
              type="checkbox"
              className="fb-gate-checkbox"
              name="confirm"
              value="1"
              required
            />
            <span>
              {"I confirm I own a legal copy of each original film before I play its edit."}
            </span>
          </label>
          <p className="fb-gate-hint">
            {"Check the box above, then tap OK to continue."}
          </p>
          <div className="fb-gate-actions">
            <button type="submit" className="fb-btn fb-btn-primary fb-gate-ok">
              OK — I confirm
            </button>
          </div>
        </form>
        <p className="fb-gate-links">
          <a href="/legal">Ownership policy</a>
          {' · '}
          <a href="/terms">Terms</a>
        </p>
      </div>
    </div>
  )
}
