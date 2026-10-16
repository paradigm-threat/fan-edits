/**
 * Inline SVG marks — brand art lives under hooks/client/brand/svg/.
 */
import React from 'react'

/** Stacked Flashback mark (png/icon-192.png) — film frames + FLASHBACK / REPOSITORY. */
export function BrandMark(props) {
  let className = 'fb-icon fb-icon-brand'
  let width = 32
  let height = 32
  try {
    if (props && props.className) {
      className = className + ' ' + props.className
    }
    if (props && props.width) width = props.width
    if (props && props.height) height = props.height
  } catch (e) {}
  return (
    <img
      className={className}
      src="/hooks/client/brand/png/icon-192.png"
      width={width}
      height={height}
      alt=""
      aria-hidden="true"
    />
  )
}

/** @deprecated Prefer BrandMark / brand SVG assets */
export function TicketIcon(props) {
  return BrandMark(props)
}

export function PlayChevron(props) {
  let className = 'fb-icon fb-icon-play'
  try {
    if (props && props.className) {
      className = className + ' ' + props.className
    }
  } catch (e) {}
  return (
    <svg className={className} viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <path fill="currentColor" d="M12 9l12 7-12 7V9z" />
    </svg>
  )
}

export function MarqueeBulb(props) {
  let className = 'fb-icon fb-icon-bulb'
  try {
    if (props && props.className) {
      className = className + ' ' + props.className
    }
  } catch (e) {}
  return (
    <svg className={className} viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
      <circle cx="6" cy="6" r="4" fill="currentColor" />
    </svg>
  )
}
