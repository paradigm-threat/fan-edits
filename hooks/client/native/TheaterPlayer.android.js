/**
 * Android CleverScript host for TheaterPlayer.
 * Seed probe, then the shared relay-video-player builtin.
 */
import React, { useState } from 'react'
import { VideoPlayer } from '@clevertree/video'

export default function TheaterPlayer(props) {
  const p = props || {}
  const src = p.src || ''
  const seedState = useState('idle')
  const seed = seedState[0]
  const setSeed = seedState[1]

  if (p.unlocked !== true) {
    return (
      <div className="fb-theater-locked">
        <p>Confirm you own a legal copy to play this edit.</p>
      </div>
    )
  }
  if (src.length === 0) {
    return <p>No media path for this title.</p>
  }
  if (seed === 'idle') {
    let next = 'ready'
    try {
      const statusUrl = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'relayAssetStatus=1'
      const res = fetch(statusUrl)
      if (res && res.text) {
        const j = JSON.parse(res.text)
        if (j && j.error && j.error !== 'ok') {
          next = j.message || 'This file needs to be seeded'
        }
      }
    } catch (e) {
      next = 'This file needs to be seeded'
    }
    setSeed(next)
  }
  if (seed !== 'ready') {
    return (
      <div className="fb-theater-seed">
        <p>{seed === 'idle' ? 'Checking whether this file is seeded…' : seed}</p>
        <button
          type="button"
          onClick={() => {
            setSeed('idle')
          }}
        >
          Retry
        </button>
      </div>
    )
  }
  return (
    <div className="fb-theater-player">
      <VideoPlayer
        src={src}
        controls={true}
        playing={p.playing === true}
        command={p.command}
        commandSeq={p.commandSeq}
      />
      {p.cid ? <p>CID {p.cid}</p> : null}
    </div>
  )
}
