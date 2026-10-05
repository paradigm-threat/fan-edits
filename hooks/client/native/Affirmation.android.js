/**
 * Android CleverScript host for Affirmation.
 * Same exports as Affirmation.js so the shell can prefer this file for the import.
 * Web keeps Affirmation.js + Affirmation.host.js.
 */
import React, { useState } from 'react'
import { relaySkipAffirmations } from '@hooks'

var WELCOME_KEY = 'flashback.ownershipAck.v1'

export function welcomeStorageKey() {
  return WELCOME_KEY
}

export function movieStorageKey(slug) {
  let s = ''
  if (slug !== null) {
    s = '' + slug
  }
  return 'flashback.movieOwn.v1.' + s
}

function skipAffirmations() {
  if (relaySkipAffirmations === true) {
    return true
  }
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__relaySkipAffirmations === true) {
      return true
    }
  } catch (e) {}
  return false
}

export function hasStoredAck(storageKey) {
  if (skipAffirmations() === true) {
    return true
  }
  let key = ''
  if (storageKey !== null) {
    key = '' + storageKey
  }
  if (key.length === 0) {
    return false
  }
  try {
    if (typeof localStorage === 'undefined' || !localStorage.getItem) {
      return false
    }
    return localStorage.getItem(key) === '1'
  } catch (e2) {
    return false
  }
}

export function hasOwnershipAck() {
  return hasStoredAck(WELCOME_KEY) === true
}

export function hasMovieOwnAck(slug) {
  return hasStoredAck(movieStorageKey(slug)) === true
}

export function ensureOwnershipAckFromBrowser() {
  return hasOwnershipAck()
}

export function ensureMovieOwnAckFromBrowser(slug) {
  return hasMovieOwnAck(slug)
}

export default function Affirmation(props) {
  const p = props || {}
  if (skipAffirmations() === true || p.confirmed === true) {
    return null
  }
  const checkedState = useState(false)
  const checked = checkedState[0]
  const setChecked = checkedState[1]
  const title = p.title || ''
  const body = p.body || ''
  const checkboxLabel = p.checkboxLabel || 'I confirm'
  const confirmLabel = p.confirmLabel || 'OK — I confirm'
  const storageKey = p.storageKey || WELCOME_KEY
  let links = []
  try {
    const raw = p.linksJson || '[]'
    const parsed = JSON.parse(raw)
    if (parsed) {
      links = parsed
    }
  } catch (eLinks) {
    links = []
  }
  let linkNodes = []
  for (let i = 0; i < links.length; i++) {
    const it = links[i] || {}
    const label = it.label || it.href || ''
    const href = it.href || '/'
    linkNodes = linkNodes.concat([
      <a key={href || label} href={href}>
        {label}
      </a>,
    ])
  }
  let checkText = checkboxLabel
  if (checked === true) {
    checkText = 'Checked — ' + checkboxLabel
  }
  return (
    <div className="fb-affirmation">
      {p.eyebrow ? <p>{p.eyebrow}</p> : null}
      {title ? <h2>{title}</h2> : null}
      {body ? <p>{body}</p> : null}
      {linkNodes}
      <button
        type="button"
        onClick={() => {
          if (checked === true) {
            setChecked(false)
          } else {
            setChecked(true)
          }
        }}
      >
        {checkText}
      </button>
      <button
        type="button"
        onClick={() => {
          if (checked !== true) {
            return
          }
          try {
            localStorage.setItem(storageKey, '1')
            if (p.mode === 'title' || ('' + storageKey).indexOf('flashback.movieOwn.v1.') === 0) {
              localStorage.setItem(WELCOME_KEY, '1')
            }
          } catch (e) {}
          if (p.onConfirm) {
            p.onConfirm()
          }
        }}
      >
        {confirmLabel}
      </button>
    </div>
  )
}
