/**
 * Smoke: ExternalPlay stub + web host + registry wiring.
 * Run: node --test hooks/client/native/external-play.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const stub = fs.readFileSync(path.join(dir, 'ExternalPlay.js'), 'utf8')
const host = fs.readFileSync(path.join(dir, 'ExternalPlay.host.js'), 'utf8')
const registry = fs.readFileSync(path.join(dir, 'registry.host.js'), 'utf8')

test('stub emits park-native attrs only', () => {
  assert.match(stub, /data-relay-park-native="fb-external-play"/)
  assert.match(stub, /data-stream-url=\{streamUrl\}/)
  assert.match(stub, /data-unlocked=\{unlocked\}/)
  assert.match(stub, /data-setup-href=\{setupHref\}/)
  assert.doesNotMatch(stub, /onClick/)
  assert.doesNotMatch(stub, /vlc:\/\//)
})

test('web host opens vlc:// with copy + delayed fail status', () => {
  assert.match(host, /function buildExternalPlay/)
  assert.match(host, /vlc:\/\/weblink\?url=/)
  assert.match(host, /Open in VLC/)
  assert.match(host, /Copy stream URL/)
  assert.match(host, /Opening VLC/)
  assert.match(host, /Confirm ownership first/)
  assert.match(host, /data-fb-external-status/)
  assert.match(host, /__relayRegisterParkNative\('fb-external-play'/)
  assert.match(host, /setTimeout/)
})

test('web host supports Android browser via intent VIEW', () => {
  assert.match(host, /function isAndroidBrowser/)
  assert.match(host, /function intentViewUrl/)
  assert.match(host, /android\.intent\.action\.VIEW/)
  assert.match(host, /type=video\/\*/)
  assert.match(host, /scheme=https/)
  assert.match(host, /Open in external player/)
  assert.match(host, /android-intent/)
  assert.match(host, /play\.google\.com\/store\/apps\/details\?id=org\.videolan\.vlc/)
  assert.match(host, /function navigateExternal/)
  assert.match(host, /visibilitychange/)
  assert.match(host, /pagehide/)
})

test('web host re-checks ownership from html movie-ack (not frozen stub attr)', () => {
  assert.match(host, /function ownershipUnlocked/)
  assert.match(host, /data-fb-movie-ack/)
  assert.match(host, /data-fb-welcome-ack/)
  assert.match(host, /refreshUnlocked/)
  assert.match(host, /MutationObserver/)
})

test('registry loads ExternalPlay.host.js', () => {
  assert.match(registry, /ExternalPlay\.host\.js/)
  const idx = registry.indexOf('ExternalPlay.host.js')
  const theaterIdx = registry.indexOf('TheaterPlayer.host.js')
  assert.ok(theaterIdx >= 0 && idx > theaterIdx, 'ExternalPlay loads after TheaterPlayer')
})
