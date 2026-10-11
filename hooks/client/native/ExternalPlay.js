/**
 * CleverScript stub — div[data-relay-park-native=fb-external-play].
 * Web: ExternalPlay.host.js · Android: ExternalPlay.android.js
 */
import React from 'react'

export default function ExternalPlay(props) {
  const p = props || {}
  let streamUrl = ''
  if (p.streamUrl !== null && p.streamUrl !== undefined) {
    streamUrl = '' + p.streamUrl
  }
  let streamUrlWeb = ''
  if (p.streamUrlWeb !== null && p.streamUrlWeb !== undefined) {
    streamUrlWeb = '' + p.streamUrlWeb
  }
  let streamUrlMobile = ''
  if (p.streamUrlMobile !== null && p.streamUrlMobile !== undefined) {
    streamUrlMobile = '' + p.streamUrlMobile
  }
  let disableWeb = 'false'
  if (p.disableWeb === true || p.disableWeb === 'true') {
    disableWeb = 'true'
  }
  let disableMobile = 'false'
  if (p.disableMobile === true || p.disableMobile === 'true') {
    disableMobile = 'true'
  }
  let unlocked = 'false'
  if (p.unlocked === true || p.unlocked === 'true') {
    unlocked = 'true'
  }
  let setupHref = '/setup'
  if (p.setupHref !== null && p.setupHref !== undefined && ('' + p.setupHref).length > 0) {
    setupHref = '' + p.setupHref
  }
  let cid = ''
  if (p.cid !== null && p.cid !== undefined) {
    cid = '' + p.cid
  }
  let downloadName = ''
  if (p.downloadName !== null && p.downloadName !== undefined) {
    downloadName = '' + p.downloadName
  }
  let status = ''
  if (p.status !== null && p.status !== undefined) {
    status = '' + p.status
  }
  return (
    <div
      className="fb-external-play-host"
      data-relay-park-native="fb-external-play"
      data-stream-url={streamUrl}
      data-stream-url-web={streamUrlWeb}
      data-stream-url-mobile={streamUrlMobile}
      data-disable-web={disableWeb}
      data-disable-mobile={disableMobile}
      data-cid={cid}
      data-download-name={downloadName}
      data-status={status}
      data-unlocked={unlocked}
      data-setup-href={setupHref}
    />
  )
}
