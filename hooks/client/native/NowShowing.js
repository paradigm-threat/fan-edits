/**
 * CleverScript stub — div[data-relay-park-native=fb-now-showing].
 */
import React from 'react'

export default function NowShowing(props) {
  const p = props || {}
  let itemsJson = '[]'
  if (typeof p.itemsJson === 'string' && p.itemsJson.length > 0) {
    itemsJson = p.itemsJson
  }
  return (
    <div
      className="fb-now-showing-host"
      data-relay-park-native="fb-now-showing"
      data-variant={p.variant || 'lcd'}
      data-items-json={itemsJson}
      data-aria-label={p.ariaLabel || 'Now showing'}
    />
  )
}
