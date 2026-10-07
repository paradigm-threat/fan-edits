/**
 * CleverScript stub — div[data-relay-park-native=fb-board].
 * Board list + submit form run in Board.host.js.
 */
import React from 'react'

export default function Board(props) {
  const p = props || {}
  let path = '/'
  if (p.path !== null && p.path !== undefined && ('' + p.path).length > 0) {
    path = '' + p.path
  }
  let kind = 'comment'
  if (p.kind !== null && p.kind !== undefined && ('' + p.kind).length > 0) {
    kind = '' + p.kind
  }
  return (
    <div
      className="fb-board-host"
      data-relay-park-native="fb-board"
      data-path={path}
      data-kind={kind}
    />
  )
}
