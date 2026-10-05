/**
 * First-visit ownership acknowledgment — must confirm before browsing/playing.
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

export function hasOwnershipAck() {
  return readAck() === true
}

export default function OwnershipGate(props) {
  const openState = useState(readAck() !== true)
  const open = openState[0]
  const setOpen = openState[1]
  const checkedState = useState(false)
  const checked = checkedState[0]
  const setChecked = checkedState[1]

  if (open !== true) {
    return null
  }

  return (
    <div className="fb-gate" role="dialog" aria-modal="true" aria-labelledby="fb-gate-title">
      <div className="fb-gate-card">
        <p className="fb-gate-kicker">Flashback Repository</p>
        <h2 id="fb-gate-title" className="fb-gate-title">
          Own the original
        </h2>
        <p className="fb-gate-body">
          Before you play any fan edit here, you must own a legal commercial copy of the
          corresponding original film. This is the same rule used by fanedit communities for
          years: the edit is for people who already have the movie.
        </p>
        <p className="fb-gate-body">
          This site is a personal catalog of projects — not a pirate archive and not a substitute
          for buying or renting the studio release.
        </p>
        <label className="fb-gate-check">
          <input
            type="checkbox"
            checked={checked === true}
            onChange={(e) => {
              try {
                setChecked(e && e.target && e.target.checked === true)
              } catch (err) {
                setChecked(false)
              }
            }}
          />
          <span>I confirm I own a legal copy of each original film before I play its edit.</span>
        </label>
        <div className="fb-gate-actions">
          <button
            type="button"
            className="fb-btn fb-btn-primary"
            disabled={checked !== true}
            onClick={() => {
              if (checked !== true) {
                return
              }
              writeAck()
              setOpen(false)
              try {
                if (props && typeof props.onAck === 'function') {
                  props.onAck()
                }
              } catch (e) {}
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
