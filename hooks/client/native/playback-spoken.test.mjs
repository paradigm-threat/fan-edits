/**
 * Spoken ladder / escalate messages must stay clear and user-facing.
 * Run: node --test hooks/client/native/playback-spoken.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

/** Mirror of TheaterPlayer spokenPlaybackError code map (keep in sync). */
function spokenPlaybackError(err) {
  if (err && typeof err.userMessage === 'string' && err.userMessage) return err.userMessage
  const code = err && err.code ? String(err.code) : ''
  if (code === 'WEBCODECS_UNSUPPORTED') {
    return 'Full quality needs hardware decode this browser does not provide. Switching to 1080p for compatibility.'
  }
  if (code === 'SOURCE_TOO_LARGE') {
    return 'Full-quality playback is too large for this browser path. Switching to 1080p for compatibility.'
  }
  if (code === 'FETCH_FAILED') {
    return 'The video file could not be downloaded from this mirror. Trying another source.'
  }
  if (code === 'WASM_LOAD_FAILED' || code === 'ENGINE_MISSING') {
    return 'This browser could not load the extended video engine. Switching to a compatibility stream.'
  }
  if (code === 'DEMUX_FAILED') {
    return 'This file’s container could not be read. Switching to a compatibility stream.'
  }
  if (code === 'DECODE_FAILED' || code === 'UNDERRUN') {
    return 'Video decode could not keep up. Switching to a compatibility stream.'
  }
  return 'Full quality is unavailable here — switching to a compatibility stream.'
}

test('spoken messages never mention MKV extensions or Chrome Web Store', () => {
  const codes = [
    'WEBCODECS_UNSUPPORTED',
    'SOURCE_TOO_LARGE',
    'FETCH_FAILED',
    'WASM_LOAD_FAILED',
    'ENGINE_MISSING',
    'DEMUX_FAILED',
    'DECODE_FAILED',
    'UNDERRUN',
    'UNKNOWN',
  ]
  for (const code of codes) {
    const msg = spokenPlaybackError({ code })
    assert.ok(msg.length > 20)
    assert.doesNotMatch(msg, /mkv|chromewebstore|extension/i)
    assert.match(msg, /compatib|mirror|engine|container|decode|downloaded|unavailable/i)
  }
})

test('userMessage wins over code map', () => {
  assert.equal(
    spokenPlaybackError({
      code: 'FETCH_FAILED',
      userMessage: 'Custom spoken line for the audience.',
    }),
    'Custom spoken line for the audience.',
  )
})
