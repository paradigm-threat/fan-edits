/**
 * Unit tests for HEVC master + H.264 web/mobile ladder.
 * Run: node --test hooks/client/native/rendition-pick.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickPlayableSrc, prefersDesktopPlayback } from './rendition-pick.mjs'

const project = {
  path: 'FanMixes/Van Helsing - DeAnna\'d',
  media: 'Van Helsing - DeAnna\'d.hevc.mp4',
  mediaWeb: 'Van Helsing - DeAnna\'d.web-1080p.mp4',
  mediaMobile: 'Van Helsing - DeAnna\'d.mobile-720p.mp4',
}

test('prefersDesktopPlayback: wide', () => {
  assert.equal(prefersDesktopPlayback({ minWidth901: true, saveData: false }), true)
})

test('prefersDesktopPlayback: Save-Data', () => {
  assert.equal(prefersDesktopPlayback({ minWidth901: true, saveData: true }), false)
})

test('prefersDesktopPlayback: narrow', () => {
  assert.equal(prefersDesktopPlayback({ minWidth901: false }), false)
})

test('pickPlayableSrc leads with HEVC master when canPlayHevc', () => {
  const r = pickPlayableSrc(project, {
    minWidth901: true,
    saveData: false,
    canPlayAvc: true,
    canPlayHevc: true,
  })
  assert.equal(r.kind, 'master')
  assert.match(r.src, /\.hevc\.mp4$/)
  assert.equal(r.ladder[0].kind, 'master')
  assert.equal(r.ladder[1].kind, 'web')
  assert.equal(r.ladder[2].kind, 'mobile')
})

test('pickPlayableSrc mobile still tries master first then 720p', () => {
  const r = pickPlayableSrc(project, {
    minWidth901: false,
    canPlayAvc: true,
    canPlayHevc: true,
  })
  assert.equal(r.kind, 'master')
  assert.equal(r.ladder[1].kind, 'mobile')
  assert.equal(r.ladder[2].kind, 'web')
})

test('pickPlayableSrc without HEVC uses H.264 ladder then master fallback', () => {
  const r = pickPlayableSrc(project, {
    minWidth901: true,
    canPlayAvc: true,
    canPlayHevc: false,
  })
  assert.equal(r.kind, 'web')
  assert.equal(r.ladder[0].kind, 'web')
  assert.equal(r.ladder[1].kind, 'mobile')
  assert.equal(r.ladder[2].kind, 'master')
})

test('pickPlayableSrc without AVC still offers master', () => {
  const r = pickPlayableSrc(project, {
    minWidth901: true,
    canPlayAvc: false,
    canPlayHevc: true,
  })
  assert.equal(r.kind, 'master')
  assert.equal(r.ladder.length, 1)
})

test('pickPlayableSrc empty when no media', () => {
  const r = pickPlayableSrc({ path: 'FanMixes/X' }, { canPlayAvc: true, minWidth901: true })
  assert.equal(r.src, '')
})
