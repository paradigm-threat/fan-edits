/**
 * CleverScript stub — div[data-relay-park-native=fb-affirmation].
 * Host UI: Affirmation.host.js
 */
import React from 'react'

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

export function hasStoredAck(storageKey) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__relaySkipAffirmations === true) {
      return true
    }
  } catch (eSkip) {}
  let key = ''
  if (storageKey !== null) {
    key = '' + storageKey
  }
  if (key.length === 0) {
    return false
  }
  try {
    if (typeof globalThis !== 'undefined' && globalThis.document && globalThis.document.documentElement) {
      if (key === WELCOME_KEY) {
        if (globalThis.document.documentElement.getAttribute('data-fb-welcome-ack') === '1') {
          return true
        }
      } else if (key.indexOf('flashback.movieOwn.v1.') === 0) {
        const slug = key.slice('flashback.movieOwn.v1.'.length)
        if (globalThis.document.documentElement.getAttribute('data-fb-movie-ack') === slug) {
          return true
        }
      }
    }
  } catch (e) {}
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
  try {
    if (typeof globalThis === 'undefined' || !globalThis.location) {
      return hasOwnershipAck()
    }
    const search = '' + (globalThis.location.search || '')
    if (search.indexOf('ownershipAck=1') >= 0) {
      try {
        localStorage.setItem(WELCOME_KEY, '1')
      } catch (e) {}
      try {
        globalThis.document.documentElement.setAttribute('data-fb-welcome-ack', '1')
      } catch (e2) {}
    }
  } catch (e3) {}
  return hasOwnershipAck()
}

export function ensureMovieOwnAckFromBrowser(slug) {
  let s = ''
  if (slug !== null) {
    s = '' + slug
  }
  try {
    if (typeof globalThis === 'undefined' || !globalThis.location) {
      return hasMovieOwnAck(s)
    }
    const search = '' + (globalThis.location.search || '')
    const needle = 'movieOwnAck=' + s
    if (search.indexOf(needle) >= 0) {
      try {
        localStorage.setItem(movieStorageKey(s), '1')
      } catch (e) {}
      try {
        globalThis.document.documentElement.setAttribute('data-fb-movie-ack', s)
        globalThis.document.documentElement.setAttribute('data-fb-welcome-ack', '1')
      } catch (e2) {}
    }
  } catch (e3) {}
  return hasMovieOwnAck(s)
}

export default function Affirmation(props) {
  const p = props || {}
  let linksJson = ''
  if (typeof p.linksJson === 'string') {
    linksJson = p.linksJson
  }
  let body = ''
  if (typeof p.body === 'string') {
    body = p.body
  }
  let confirmed = 'false'
  if (p.confirmed === true) {
    confirmed = 'true'
  }
  return (
    <div
      className="fb-affirmation-host"
      data-relay-park-native="fb-affirmation"
      data-mode={p.mode || 'welcome'}
      data-title={p.title || ''}
      data-eyebrow={p.eyebrow || ''}
      data-body={body}
      data-checkbox-label={p.checkboxLabel || ''}
      data-confirm-label={p.confirmLabel || 'OK — I confirm'}
      data-storage-key={p.storageKey || WELCOME_KEY}
      data-confirmed={confirmed}
      data-links-json={linksJson}
      onConfirm={p.onConfirm}
    />
  )
}
