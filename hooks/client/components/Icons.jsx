/**
 * Inline SVG marks — brand art lives under hooks/client/brand/svg/.
 */
import React from 'react'

/** Film-strip + stake mark (matches brand/svg/icon-mark.svg), for small chrome. */
export function BrandMark(props) {
  let className = 'fb-icon fb-icon-brand'
  try {
    if (props && props.className) {
      className = className + ' ' + props.className
    }
  } catch (e) {}
  return (
    <svg className={className} viewBox="0 0 120 120" width="32" height="32" aria-hidden="true">
      <rect x="4" y="4" width="112" height="112" rx="18" fill="none" stroke="currentColor" strokeWidth="4" />
      <path
        d="M34 22 L86 22 L92 30 L92 90 L86 98 L34 98 L28 90 L28 30 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <rect x="36" y="36" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="36" y="50" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="36" y="64" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="36" y="78" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="76" y="36" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="76" y="50" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="76" y="64" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="76" y="78" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="56" y="38" width="8" height="48" rx="2" fill="currentColor" />
      <rect x="46" y="54" width="28" height="8" rx="2" fill="currentColor" />
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
