/**
 * First-visit ownership acknowledgment — must confirm before browsing/playing.
 *
 * CleverScript notes:
 * - Controlled checkboxes often fail to sync React state on hydrate.
 * - useState(open) is unreliable: SSR always renders the gate (no localStorage),
 *   and runtime re-runs can resurrect that SSR tree after setState(false).
 * - Visibility is derived from localStorage on every render; OK also removes the
 *   gate node so the UI dismisses even if a re-run races.
 */
import React, { useState } from 'react'

var ACK_KEY = 'flashback.ownershipAck.v1'

function readAck() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
      return false
    }
    if (!globalThis.localStorage.getItem) {
      return false
    }
    return globalThis.localStorage.getItem(ACK_KEY) === '1'
  } catch (e) {
    return false
  }
}

function writeAck() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
      return
    }
    if (!globalThis.localStorage.setItem) {
      return
    }
    globalThis.localStorage.setItem(ACK_KEY, '1')
  } catch (e) {}
}

function gateCheckboxChecked() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.document) {
      return false
    }
    let doc = globalThis.document
    if (!doc.querySelector) {
      return false
    }
    let el = doc.querySelector('input.fb-gate-checkbox')
    if (!el) {
      return false
    }
    return el.checked === true
  } catch (e) {
    return false
  }
}

function removeGateNode() {
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
    if (gate.remove) {
      gate.remove()
    } else if (gate.parentNode && gate.parentNode.removeChild) {
      gate.parentNode.removeChild(gate)
    }
  } catch (e) {}
}

export function hasOwnershipAck() {
  return readAck() === true
}

export default function OwnershipGate(props) {
  // Tick only forces a client re-render after OK; visibility comes from readAck().
  const tickState = useState(0)
  const tick = tickState[0]
  const setTick = tickState[1]

  if (readAck() === true) {
    return null
  }

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
        <label className="fb-gate-check">
          <input type="checkbox" className="fb-gate-checkbox" />
          <span>
            {"I confirm I own a legal copy of each original film before I play its edit."}
          </span>
        </label>
        <p className="fb-gate-hint">
          {"Check the box above, then tap OK to continue."}
        </p>
        <div className="fb-gate-actions">
          <button
            type="button"
            className="fb-btn fb-btn-primary fb-gate-ok"
            onClick={() => {
              if (gateCheckboxChecked() !== true) {
                return
              }
              writeAck()
              removeGateNode()
              try {
                if (props && typeof props.onAck === 'function') {
                  props.onAck()
                }
              } catch (e) {}
              try {
                setTick(tick + 1)
              } catch (e2) {}
            }}
          >
            OK — I confirm
          </button>
        </div>
        <p className="fb-gate-links">
          <a href="/legal">Ownership policy</a>
          {' · '}
          <a href="/terms">Terms</a>
        </p>
      </div>
    </div>
  )
}
