/**
 * CleverScript stub — div[data-relay-park-native=fb-live-chat].
 * Lazy embed UI lives in LiveChat.host.js.
 */
import React from 'react'

export default function LiveChat(props) {
  const p = props || {}
  let channel = 'flashback'
  if (p.channel !== null && p.channel !== undefined && ('' + p.channel).length > 0) {
    channel = '' + p.channel
  }
  let path = '/'
  if (p.path !== null && p.path !== undefined && ('' + p.path).length > 0) {
    path = '' + p.path
  }
  let mode = 'embed'
  if (p.mode !== null && p.mode !== undefined && ('' + p.mode).length > 0) {
    mode = '' + p.mode
  }
  return (
    <div
      className="fb-live-chat-host"
      data-relay-park-native="fb-live-chat"
      data-channel={channel}
      data-path={path}
      data-mode={mode}
    />
  )
}
