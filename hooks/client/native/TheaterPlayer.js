/**
 * CleverScript stub — div[data-relay-park-native=fb-theater-player].
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
  return (
    <div
      className="fb-theater-player-host"
      data-relay-park-native="fb-theater-player"
      data-src={p.src || ''}
      data-poster={p.poster || ''}
      data-cid={p.cid || ''}
      data-seed-state={p.seedState || 'pending'}
      data-seed-message={p.seedMessage || 'This file needs to be seeded'}
      data-seed-hint={
        p.seedHint ||
        'The content hash is known. Until a peer seeds the bytes onto IPFS, playback cannot start.'
      }
      data-playing={playing}
      data-command={command}
      data-command-seq={commandSeq}
      data-command-arg={commandArg}
      data-unlocked={unlocked}
      onPlay={p.onPlay}
      onPause={p.onPause}
      onEnded={p.onEnded}
      onError={p.onError}
    />
  )
}
