/**
 * CleverScript stub — div[data-relay-park-native=fb-theater-player].
 * Only read props the tip always passes; CleverScript throws on missing keys.
 */
import React from 'react'

export default function TheaterPlayer(props) {
  const p = props || {}
  let playing = 'false'
  if (p.playing === true) {
    playing = 'true'
  }
  let unlocked = 'false'
  if (p.unlocked === true) {
    unlocked = 'true'
  }
  let command = '0'
  if (p.command !== null) {
    command = '' + p.command
  }
  let commandSeq = '0'
  if (p.commandSeq !== null) {
    commandSeq = '' + p.commandSeq
  }
  let commandArg = ''
  if (p.commandArg !== null) {
    commandArg = '' + p.commandArg
  }
  let startAt = ''
  if (p.startAt !== null) {
    startAt = '' + p.startAt
  }
  return (
    <div
      className="fb-theater-player-host"
      data-relay-park-native="fb-theater-player"
      data-src={p.src || ''}
      data-poster=""
      data-cid={p.cid || ''}
      data-seed-state={p.seedState || 'pending'}
      data-seed-message="This file needs to be seeded"
      data-seed-hint="The content hash is known. Until a peer seeds the bytes onto IPFS, playback cannot start."
      data-playing={playing}
      data-command={command}
      data-command-seq={commandSeq}
      data-command-arg={commandArg}
      data-start-at={startAt}
      data-unlocked={unlocked}
    />
  )
}
