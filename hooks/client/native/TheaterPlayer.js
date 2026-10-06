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
  let srcWeb = ''
  if (p.srcWeb !== null) {
    srcWeb = '' + p.srcWeb
  }
  let srcMobile = ''
  if (p.srcMobile !== null) {
    srcMobile = '' + p.srcMobile
  }
  let srcMaster = ''
  if (p.srcMaster !== null) {
    srcMaster = '' + p.srcMaster
  }
  let subtitlesJson = '[]'
  if (p.subtitlesJson !== null && p.subtitlesJson !== '') {
    subtitlesJson = '' + p.subtitlesJson
  }
  return (
    <div
      className="fb-theater-player-host"
      data-relay-park-native="fb-theater-player"
      data-src={p.src || ''}
      data-src-web={srcWeb}
      data-src-mobile={srcMobile}
      data-src-master={srcMaster}
      data-subtitles-json={subtitlesJson}
      data-poster=""
      data-cid={p.cid || ''}
      data-seed-state={p.seedState || 'pending'}
      data-seed-message="Getting the movie ready…"
      data-seed-hint="This usually takes a moment. Please wait."
      data-playing={playing}
      data-command={command}
      data-command-seq={commandSeq}
      data-command-arg={commandArg}
      data-start-at={startAt}
      data-unlocked={unlocked}
    />
  )
}
