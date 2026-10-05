/**
 * Inline SVG marks — no external icon pack.
 */
import React from 'react'

export function TicketIcon(props) {
  let className = 'fb-icon fb-icon-ticket'
  try {
    if (props && props.className) className = className + ' ' + props.className
  } catch (e) {}
  return (
    <svg className={className} viewBox="0 0 48 32" width="48" height="32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2 8h8a4 4 0 0 0 0 8 4 4 0 0 0 0 8H2V8zm10 0h24v16H12V8zm26 0h8v6a4 4 0 0 0 0 4v6h-8V8zM16 12h4v2h-4v-2zm0 5h10v2H16v-2z"
        opacity="0.92"
      />
    </svg>
  )
}

export function PlayChevron(props) {
  let className = 'fb-icon fb-icon-play'
  try {
    if (props && props.className) className = className + ' ' + props.className
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
    if (props && props.className) className = className + ' ' + props.className
  } catch (e) {}
  return (
    <svg className={className} viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
      <circle cx="6" cy="6" r="4" fill="currentColor" />
    </svg>
  )
}
