export default function run(ctx) {
  return validateChangedFiles(ctx)
}

var COMMENTS_PREFIX = '.relay/comments/by-path/'
var COMMENTS_MAX_BYTES = 32768

export function validateChangedFiles(ctx) {
  var files = ctx.files
  if (files === null) return true
  // CleverScript has no `undefined` binding — avoid !== undefined (throws; empty catch hid branch).
  var branch = ctx.branch ? '' + ctx.branch : ''
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

    if (startsWith(p, COMMENTS_PREFIX)) {
      if (branch !== 'comments') {
        return {
          ok: false,
          error: 'board posts (.relay/comments/) only allowed on branch comments, not ' + branch,
        }
      }
      if (!endsWith(p, '.md') && !endsWith(p, '.MD')) {
        return { ok: false, error: 'board posts must be markdown: ' + p }
      }
      var body = files[p]
      var size = 0
      if (typeof body === 'string') {
        size = body.length
      } else if (body && typeof body.byteLength === 'number') {
        size = body.byteLength
      }
      if (size > COMMENTS_MAX_BYTES) {
        return { ok: false, error: 'board post too large (max ' + COMMENTS_MAX_BYTES + ' bytes)' }
      }
      continue
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
  if (p === 'now-showing.json') return true
  if (p === 'IPFS_ROOT') return true
  if (p === 'site.webmanifest') return true
  if (p === 'package.json') return true
  if (p === '.relay.yaml') return true
  if (p === '.gitignore') return true
  if (startsWith(p, '.relay/assets/') && endsWith(p, '.ipfs')) return true
  if (startsWith(p, 'hooks/')) return true
  if (startsWith(p, 'scripts/')) return true
  if (startsWith(p, 'docs/') && (endsWith(p, '.md') || endsWith(p, '.MD'))) return true
  // Flashback APK sideload + in-app update manifest (git tip, not IPFS)
  if (startsWith(p, 'downloads/') && (endsWith(p, '.apk') || endsWith(p, '.json') || endsWith(p, '.md') || endsWith(p, '.MD'))) return true
  if (endsWith(p, '.md') || endsWith(p, '.MD')) return true
  if (endsWith(p, '.reel')) return true
  if (endsWith(p, '.srt') || endsWith(p, '.SRT')) return true
  if (endsWith(p, '.ass') || endsWith(p, '.ASS')) return true
  if (contains(p, 'remove-') && (endsWith(p, '-ranges.json') || endsWith(p, '-ranges.JSON'))) return true
  if (endsWith(p, '.relay.shifted.srt')) return true
  return false
}
