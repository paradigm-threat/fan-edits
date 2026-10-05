/**
 * CleverScript stub — tag `fb-theater-player`.
 * Host: TheaterPlayer.web.js (video + seed/inspect + external control props).
 */
import React from 'react'

export default function TheaterPlayer(props) {
  const p = props || {}
  return React.createElement('fb-theater-player', {
    className: 'fb-theater-player-host',
    src: p.src || '',
    poster: p.poster || '',
    cid: p.cid || '',
    seedState: p.seedState || 'pending',
    seedMessage: p.seedMessage || 'This file needs to be seeded',
    seedHint:
      p.seedHint ||
      'The content hash is known. Until a peer seeds the bytes onto IPFS, playback cannot start.',
    playing: p.playing === true ? 'true' : 'false',
    command: p.command != null ? String(p.command) : '0',
    commandSeq: p.commandSeq != null ? String(p.commandSeq) : '0',
    commandArg: p.commandArg != null ? String(p.commandArg) : '',
    unlocked: p.unlocked === true ? 'true' : 'false',
    onPlay: p.onPlay,
    onPause: p.onPause,
    onEnded: p.onEnded,
    onError: p.onError,
  })
}
