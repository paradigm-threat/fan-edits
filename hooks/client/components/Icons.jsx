/**
 * Inline SVG marks — brand art lives under hooks/client/brand/svg/.
 */
import React from 'react'

/** Flat 3-node Relay film mark (matches brand/svg/icon-mark.svg), for small chrome. */
export function BrandMark(props) {
  let className = 'fb-icon fb-icon-brand'
  try {
    if (props && props.className) {
      className = className + ' ' + props.className
    }
  } catch (e) {}
  return (
    <svg className={className} viewBox="0 0 120 120" width="32" height="32" aria-hidden="true">
      <rect x="6" y="6" width="108" height="108" rx="18" fill="none" stroke="currentColor" strokeWidth="5" />
      <rect x="18" y="22" width="24" height="76" rx="8" fill="none" stroke="currentColor" strokeWidth="4.5" />
      <circle cx="30" cy="38" r="5.5" fill="currentColor" />
      <circle cx="30" cy="82" r="5.5" fill="currentColor" />
      <rect x="48" y="22" width="24" height="76" rx="8" fill="none" stroke="currentColor" strokeWidth="4.5" />
      <circle cx="60" cy="38" r="5.5" fill="currentColor" />
      <circle cx="60" cy="82" r="5.5" fill="currentColor" />
      <rect x="78" y="22" width="24" height="76" rx="8" fill="none" stroke="currentColor" strokeWidth="4.5" />
      <circle cx="90" cy="38" r="5.5" fill="currentColor" />
      <circle cx="90" cy="82" r="5.5" fill="currentColor" />
      <rect x="40" y="56" width="10" height="8" rx="2" fill="currentColor" />
      <rect x="70" y="56" width="10" height="8" rx="2" fill="currentColor" />
    </svg>
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
