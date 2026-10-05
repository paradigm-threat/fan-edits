/**
 * CleverScript stub — div[data-relay-park-native=fb-theater-player].
 */
import React from 'react'

export default function TheaterPlayer(props) {
  const p = props || {}
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
      data-playing={p.playing === true ? 'true' : 'false'}
      data-command={p.command !== null && p.command !== undefined ? String(p.command) : '0'}
      data-command-seq={p.commandSeq !== null && p.commandSeq !== undefined ? String(p.commandSeq) : '0'}
      data-command-arg={p.commandArg !== null && p.commandArg !== undefined ? String(p.commandArg) : ''}
      data-unlocked={p.unlocked === true ? 'true' : 'false'}
      onPlay={p.onPlay}
      onPause={p.onPause}
      onEnded={p.onEnded}
      onError={p.onError}
    />
  )
}
