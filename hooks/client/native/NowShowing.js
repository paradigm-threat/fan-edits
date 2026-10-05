/**
 * CleverScript stub — tag `fb-now-showing`.
 * itemsJson: [{ title, href, poster? }]
 * variant: lcd | carousel
 */
import React from 'react'

export default function NowShowing(props) {
  const p = props || {}
  let itemsJson = typeof p.itemsJson === 'string' ? p.itemsJson : ''
  if (!itemsJson && p.items) {
    try {
      itemsJson = JSON.stringify(p.items)
    } catch (e) {
      itemsJson = '[]'
    }
  }
  if (!itemsJson) {
    itemsJson = '[]'
  }
  return React.createElement('fb-now-showing', {
    className: 'fb-now-showing-host',
    variant: p.variant || 'lcd',
    itemsJson: itemsJson,
    ariaLabel: p.ariaLabel || 'Now showing',
  })
}
