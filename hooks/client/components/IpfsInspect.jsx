/**
 * Compact IPFS CID inspect row — SSR-safe (no VideoPlayer dependency).
 * CleverScript: no ^ regex, no Array.push, arrow callbacks, braced if, globalThis.
 */
import React from 'react'

function str(v) {
  if (v === null) {
    return ''
  }
  if (typeof v === 'boolean') {
    if (v) {
      return 'true'
    }
    return 'false'
  }
  if (typeof v === 'number') {
    return '' + v
  }
  if (typeof v === 'string') {
    return v
  }
  return ''
}

export function looksLikeCid(raw) {
  const s = str(raw).trim()
  if (s.length < 10) {
    return false
  }
  if (s.indexOf(' ') >= 0 || s.indexOf('/') >= 0 || s.indexOf('#') >= 0) {
    return false
  }
  if (s.indexOf('baf') === 0) {
    return true
  }
  if (s.indexOf('Qm') === 0) {
    return true
  }
  return s.length >= 46
}

export function copyText(text) {
  const t = str(text)
  if (t.length === 0) {
    return
  }
  try {
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.navigator &&
      globalThis.navigator.clipboard &&
      globalThis.navigator.clipboard.writeText
    ) {
      globalThis.navigator.clipboard.writeText(t)
      return
    }
  } catch (e) {}
  try {
    if (typeof globalThis === 'undefined' || !globalThis.document) {
      return
    }
    const doc = globalThis.document
    const el = doc.createElement('textarea')
    el.value = t
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    doc.body.appendChild(el)
    el.select()
    if (doc.execCommand) {
      doc.execCommand('copy')
    }
    doc.body.removeChild(el)
  } catch (e2) {}
}

/** relay-ipfs-v1 stub: line 2 is the CID. */
export function parseCidFromStub(text) {
  const raw = str(text)
  if (raw.length === 0) {
    return ''
  }
  const lines = raw.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = str(lines[i]).trim()
    if (line.length > 0 && looksLikeCid(line)) {
      return line
    }
    i = i + 1
  }
  return ''
}

function fetchTextPath(path) {
  try {
    let p = str(path)
    if (p.charAt(0) === '/') {
      p = p.slice(1)
    }
    if (p.length === 0) {
      return ''
    }
    const res = fetch('/' + p)
    if (res && res.ok === true && res.text) {
      return res.text
    }
  } catch (e) {}
  return ''
}

/**
 * Resolve CID for a catalog project: .ipfs stub first, then assets.manifest.json.
 * logicalPath like "FanMixes/Title/file.mkv"
 */
export function resolveMediaCid(logicalPath) {
  const logical = str(logicalPath).trim()
  if (logical.length === 0) {
    return ''
  }
  let pathNoSlash = logical
  if (pathNoSlash.charAt(0) === '/') {
    pathNoSlash = pathNoSlash.slice(1)
  }
  const stub = fetchTextPath('.relay/assets/' + pathNoSlash + '.ipfs')
  const fromStub = parseCidFromStub(stub)
  if (fromStub.length > 0) {
    return fromStub
  }
  try {
    const manText = fetchTextPath('assets.manifest.json')
    if (manText.length > 0 && manText.charAt(0) === '{') {
      const data = JSON.parse(manText)
      const assets = data && data.assets ? data.assets : null
      if (assets && typeof assets.length === 'number') {
        let i = 0
        while (i < assets.length) {
          const a = assets[i]
          if (a && str(a.path) === pathNoSlash && looksLikeCid(a.ipfs)) {
            return str(a.ipfs).trim()
          }
          i = i + 1
        }
      }
    }
  } catch (e2) {}
  return ''
}

export function encodeCid(cid) {
  const c = str(cid).trim()
  try {
    if (typeof globalThis !== 'undefined' && globalThis.encodeURIComponent) {
      return globalThis.encodeURIComponent(c)
    }
  } catch (e) {}
  return c
}

/**
 * Compact inspect row: copyable CID + public CID tools / gateways.
 */
export default function IpfsInspectRow(props) {
  let cid = ''
  let providers = null
  try {
    cid = str(props.cid).trim()
  } catch (e) {
    cid = ''
  }
  try {
    if (typeof props.providers === 'number') {
      providers = props.providers
    }
  } catch (e2) {}
  if (!looksLikeCid(cid)) {
    return null
  }
  const enc = encodeCid(cid)
  const inspector = 'https://cid.ipfs.tech/#' + cid
  const check = 'https://check.ipfs.network/?cid=' + enc
  const gatewayIo = 'https://ipfs.io/ipfs/' + enc
  const gatewayDweb = 'https://dweb.link/ipfs/' + enc
  let providerNote = ''
  if (providers !== null) {
    if (providers === 0) {
      providerNote = 'Relay sees 0 providers for this CID.'
    } else if (providers === 1) {
      providerNote = 'Relay sees 1 provider for this CID.'
    } else {
      providerNote = 'Relay sees ' + providers + ' providers for this CID.'
    }
  }
  return (
    <div className="fb-media-inspect" data-ipfs-inspect="1">
      <p className="fb-media-inspect-label">Inspect on IPFS</p>
      <div className="fb-media-inspect-cid-row">
        <code className="fb-media-inspect-cid" title="Content identifier">
          {cid}
        </code>
        <button
          type="button"
          className="fb-btn fb-media-inspect-copy"
          onClick={() => {
            copyText(cid)
          }}
        >
          Copy CID
        </button>
      </div>
      <div className="fb-media-inspect-links">
        <a href={inspector} target="_blank" rel="noopener noreferrer">
          CID Inspector
        </a>
        <a href={check} target="_blank" rel="noopener noreferrer">
          Providers
        </a>
        <a href={gatewayIo} target="_blank" rel="noopener noreferrer">
          ipfs.io
        </a>
        <a href={gatewayDweb} target="_blank" rel="noopener noreferrer">
          dweb.link
        </a>
      </div>
      {providerNote ? <p className="fb-media-inspect-note">{providerNote}</p> : null}
      <p className="fb-media-inspect-note">
        Public gateway fetches from this page are often CORS-blocked; use the links. Seed status is from Relay.
      </p>
    </div>
  )
}
