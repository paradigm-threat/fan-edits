/**
 * Shared ladder heuristics for TheaterPlayer + unit tests.
 * Prefer HEVC archival MP4 when the browser can decode it; else H.264 web/mobile.
 */

export function prefersDesktopPlayback(env) {
  const e = env || {}
  try {
    if (e.saveData === true) return false
  } catch (_) {}
  try {
    if (e.minWidth901 === false) return false
    if (e.minWidth901 === true) return true
  } catch (_) {}
  return true
}

/**
 * @param {{ mediaMobile?: string, mediaWeb?: string, media?: string, path?: string }} project
 * @param {{ saveData?: boolean, effectiveType?: string, minWidth901?: boolean, canPlayAvc?: boolean, canPlayHevc?: boolean }} env
 */
export function pickPlayableSrc(project, env) {
  const p = project || {}
  const path = String(p.path || '').replace(/^\/+/, '').replace(/\/+$/, '')
  const mobile = String(p.mediaMobile || '')
  const web = String(p.mediaWeb || '')
  const master = String(p.media || '')

  const canAvc = env && env.canPlayAvc === false ? false : true
  const canHevc = env && env.canPlayHevc === false ? false : true
  const desktop = prefersDesktopPlayback(env)

  const ladder = []
  if (master && canHevc) ladder.push({ kind: 'master', basename: master })
  if (desktop) {
    if (web && canAvc) ladder.push({ kind: 'web', basename: web })
    if (mobile && canAvc) ladder.push({ kind: 'mobile', basename: mobile })
  } else {
    if (mobile && canAvc) ladder.push({ kind: 'mobile', basename: mobile })
    if (web && canAvc) ladder.push({ kind: 'web', basename: web })
  }
  // Last resort: archival even if canPlayHevc was empty (some Chrome builds).
  if (master && (!canHevc || ladder.length === 0)) {
    let has = false
    for (let i = 0; i < ladder.length; i++) {
      if (ladder[i].kind === 'master') {
        has = true
        break
      }
    }
    if (!has) ladder.push({ kind: 'master', basename: master })
  }

  if (ladder.length === 0) {
    return { src: '', kind: '', basename: '', ladder: [] }
  }
  const first = ladder[0]
  const src = path && first.basename ? '/' + path + '/' + first.basename : ''
  return {
    src: src,
    kind: first.kind,
    basename: first.basename,
    ladder: ladder.map((x) => ({
      kind: x.kind,
      basename: x.basename,
      src: path && x.basename ? '/' + path + '/' + x.basename : '',
    })),
  }
}

export function envFromGlobal(g) {
  const out = {
    saveData: false,
    effectiveType: '',
    minWidth901: true,
    canPlayAvc: true,
    canPlayHevc: true,
  }
  try {
    const c = g && g.navigator && g.navigator.connection
    if (c) {
      if (c.saveData === true) out.saveData = true
      if (c.effectiveType) out.effectiveType = String(c.effectiveType)
    }
  } catch (_) {}
  try {
    if (g && g.matchMedia) {
      out.minWidth901 = !!g.matchMedia('(min-width: 901px)').matches
    }
  } catch (_) {}
  try {
    if (g && g.document && g.document.createElement) {
      const v = g.document.createElement('video')
      if (v && typeof v.canPlayType === 'function') {
        const avc = v.canPlayType('video/mp4; codecs="avc1.42E01E"')
        out.canPlayAvc = avc === 'probably' || avc === 'maybe'
        const hevc =
          v.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
          v.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"')
        out.canPlayHevc = hevc === 'probably' || hevc === 'maybe'
      }
    }
  } catch (_) {}
  return out
}
