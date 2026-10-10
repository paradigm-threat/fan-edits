/**
 * Home now-showing carousel — manual prev/next, image or blurb slides.
 * CleverScript-safe: no dynamic object keys; optional fields via try/catch.
 * Titles come from status=showing (set via now-showing.json → generate-index-json).
 */
import React, { useState } from 'react'

var MAX_SLIDES = 8

function str(v) {
  if (v === null) {
    return ''
  }
  if (typeof v === 'undefined') {
    return ''
  }
  if (typeof v === 'string') {
    return v
  }
  return '' + v
}

function optStr(obj, key) {
  try {
    if (!obj) {
      return ''
    }
    if (key === 'image') {
      return str(obj.image)
    }
    if (key === 'blurb') {
      return str(obj.blurb)
    }
    if (key === 'media') {
      return str(obj.media)
    }
    if (key === 'slug') {
      return str(obj.slug)
    }
    if (key === 'title') {
      return str(obj.title)
    }
    if (key === 'status') {
      return str(obj.status)
    }
  } catch (e) {}
  return ''
}

function isShowing(p) {
  if (!p) {
    return false
  }
  return optStr(p, 'status') === 'showing'
}

function hasPoster(p) {
  return optStr(p, 'image').length > 0
}

/**
 * Only status=showing titles (from now-showing.json). Prefer poster art.
 * Cap at MAX_SLIDES.
 */
export function pickRecentProjects(projects) {
  let out = []
  if (!projects || projects.length === 0) {
    return out
  }

  let withImage = []
  let textOnly = []
  for (let j = 0; j < projects.length; j++) {
    let p = projects[j]
    if (isShowing(p) !== true) {
      continue
    }
    if (hasPoster(p) === true) {
      withImage = withImage.concat([p])
    } else {
      textOnly = textOnly.concat([p])
    }
  }

  let fill = withImage.concat(textOnly)
  for (let k = 0; k < fill.length; k++) {
    if (out.length >= MAX_SLIDES) {
      break
    }
    out = out.concat([fill[k]])
  }
  return out
}

function imageSrc(project) {
  let img = optStr(project, 'image')
  if (img.length === 0) {
    return ''
  }
  if (img.charAt(0) === '/') {
    return img
  }
  return '/' + img
}

export default function RecentSlideshow(props) {
  let projects = []
  try {
    if (props && props.projects) {
      projects = props.projects
    }
  } catch (e) {}

  let slides = pickRecentProjects(projects)
  const idxState = useState(0)
  let idx = idxState[0]
  let setIdx = idxState[1]

  if (slides.length === 0) {
    return null
  }

  let safeIdx = idx
  if (safeIdx < 0 || safeIdx >= slides.length) {
    safeIdx = 0
  }

  let current = slides[safeIdx]
  let img = imageSrc(current)
  let hasImage = img.length > 0
  let blurb = optStr(current, 'blurb')
  if (blurb.length > 220) {
    blurb = blurb.slice(0, 217) + '…'
  }
  let href = '/' + optStr(current, 'slug')
  let status = optStr(current, 'status')
  if (status.length === 0) {
    status = 'ready'
  }
  let label = (safeIdx + 1) + ' / ' + slides.length
  let title = optStr(current, 'title')

  let goPrev = () => {
    let next = safeIdx - 1
    if (next < 0) {
      next = slides.length - 1
    }
    setIdx(next)
  }

  let goNext = () => {
    let next = safeIdx + 1
    if (next >= slides.length) {
      next = 0
    }
    setIdx(next)
  }

  return (
    <section className="fb-now-showing" aria-label="Now showing">
      <div className="fb-now-showing-head">
        <div className="fb-now-showing-title-block">
          <h2 className="fb-section-title fb-now-showing-title">Now showing</h2>
          <p className="fb-now-showing-sub">
            Ready to play or download on the server right now — not the full library. Other titles:
            stream/download via IPFS when peers are online, or{' '}
            <a className="fb-link" href="/request">
              request Drive links
            </a>
            .
          </p>
        </div>
        <p className="fb-now-showing-count">{label}</p>
      </div>
      <div className="fb-slideshow">
        <button
          type="button"
          className="fb-slide-nav fb-slide-prev"
          aria-label="Previous title"
          onClick={goPrev}
        >
          ‹
        </button>
        <a className={'fb-slide' + (hasImage === true ? ' fb-slide-has-image' : ' fb-slide-text')} href={href}>
          {hasImage === true ? (
            <div className="fb-slide-art">
              <img className="fb-slide-img" src={img} alt="" />
            </div>
          ) : null}
          <div className="fb-slide-copy">
            <p className="fb-slide-kicker">Feature presentation</p>
            <h3 className="fb-slide-name">{title}</h3>
            {blurb.length > 0 ? (
              <p className="fb-slide-blurb">{blurb}</p>
            ) : null}
            <p className={'fb-slide-meta fb-status-' + status}>{status}</p>
          </div>
        </a>
        <button
          type="button"
          className="fb-slide-nav fb-slide-next"
          aria-label="Next title"
          onClick={goNext}
        >
          ›
        </button>
      </div>
    </section>
  )
}
