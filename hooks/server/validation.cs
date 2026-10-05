export default function run(ctx) {
  return validateChangedFiles(ctx)
}

export function validateChangedFiles(ctx) {
  var files = ctx.files
  if (files === null) return true
  var keys = Object.keys(files)
  for (var i = 0; i < keys.length; i++) {
    var p = keys[i]

    if (isBlockedMedia(p)) {
      return { ok: false, error: 'video/audio media cannot be committed via PUT: ' + p }
    }

    if (startsWith(p, 'media/')) {
      return { ok: false, error: 'media/ paths are gitignored: ' + p }
    }

    if (endsWith(p, '.video-binding.json') || endsWith(p, '.sync.env')) {
      return { ok: false, error: 'local binding file rejected: ' + p }
    }

    if (endsWith(p, '.debug.json')) {
      return { ok: false, error: 'debug artifact rejected: ' + p }
    }

    if (!isAllowedPath(p)) {
      return { ok: false, error: 'path not in PUT allowlist: ' + p }
    }
  }

  return true
}

function endsWith(s, suffix) {
  return s.length >= suffix.length && s.slice(s.length - suffix.length) === suffix
}

function startsWith(s, prefix) {
  return s.length >= prefix.length && s.slice(0, prefix.length) === prefix
}

function contains(s, sub) {
  return s.indexOf(sub) >= 0
}

function isBlockedMedia(p) {
  if (endsWith(p, '.mkv') || endsWith(p, '.MKV')) return true
  if (endsWith(p, '.mp4') || endsWith(p, '.MP4')) return true
  if (endsWith(p, '.mov') || endsWith(p, '.MOV')) return true
  if (endsWith(p, '.avi') || endsWith(p, '.AVI')) return true
  if (endsWith(p, '.mp3') || endsWith(p, '.MP3')) return true
  if (endsWith(p, '.wav') || endsWith(p, '.WAV')) return true
  return false
}

function isAllowedPath(p) {
  if (p === 'index.json') return true
  if (p === 'assets.manifest.json') return true
  if (p === '.relay.yaml') return true
  if (startsWith(p, '.relay/assets/') && endsWith(p, '.ipfs')) return true
  if (startsWith(p, 'hooks/')) return true
  if (startsWith(p, 'scripts/')) return true
  if (endsWith(p, '.md') || endsWith(p, '.MD')) return true
  if (endsWith(p, '.reel')) return true
  if (endsWith(p, '.srt') || endsWith(p, '.SRT')) return true
  if (endsWith(p, '.ass') || endsWith(p, '.ASS')) return true
  if (contains(p, 'remove-') && (endsWith(p, '-ranges.json') || endsWith(p, '-ranges.JSON'))) return true
  if (endsWith(p, '.relay.shifted.srt')) return true
  return false
}
