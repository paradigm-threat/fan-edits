/**
 * Shared ladder heuristics for TheaterPlayer + unit tests.
 * Prefer archival MKV master first; fall back to H.264 MP4 rungs.
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
 * @param {{ saveData?: boolean, effectiveType?: string, minWidth901?: boolean, canPlayAvc?: boolean }} env
 */
export function pickPlayableSrc(project, env) {
  const p = project || {}
  const path = String(p.path || '').replace(/^\/+/, '').replace(/\/+$/, '')
  const mobile = String(p.mediaMobile || '')
  const web = String(p.mediaWeb || '')
  const master = String(p.media || '')

  const canAvc = env && env.canPlayAvc === false ? false : true
  const desktop = prefersDesktopPlayback(env)

  const ladder = []
  // Always try MKV master first — push highest quality; host falls back on decode failure.
  if (master) ladder.push({ kind: 'master', basename: master })
  if (desktop) {
    if (web && canAvc) ladder.push({ kind: 'web', basename: web })
    if (mobile && canAvc) ladder.push({ kind: 'mobile', basename: mobile })
  } else {
    if (mobile && canAvc) ladder.push({ kind: 'mobile', basename: mobile })
    if (web && canAvc) ladder.push({ kind: 'web', basename: web })
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
  const out = { saveData: false, effectiveType: '', minWidth901: true, canPlayAvc: true }
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
        const r = v.canPlayType('video/mp4; codecs="avc1.42E01E"')
        out.canPlayAvc = r === 'probably' || r === 'maybe'
      }
    }
  } catch (_) {}
  return out
}
