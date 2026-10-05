/**
 * Android CleverScript host for NowShowing.
 * Horizontal row the shell scrolls when data-relay-scroll="x".
 */
import React from 'react'

export default function NowShowing(props) {
  const p = props || {}
  let items = []
  try {
    const raw = p.itemsJson || '[]'
    const parsed = JSON.parse(raw)
    if (parsed) {
      items = parsed
    }
  } catch (e) {
    items = []
  }
  if (!items || items.length === 0) {
    return null
  }
  let cards = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {}
    const title = it.title || ''
    const href = it.href || '/'
    cards = cards.concat([
      <a key={href || title} className="fb-now-card" href={href}>
        {title}
      </a>,
    ])
  }
  return (
    <div
      className="fb-now-showing"
      data-relay-scroll="x"
      style={{ flexDirection: 'row' }}
    >
      {cards}
    </div>
  )
}
