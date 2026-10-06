/**
 * Static contract for Flashback Android hosts.
 * These files are CleverScript the shell prefers over Foo.js.
 * They are not executed here (JSX). Web hosts stay in native-hosts.spec.mjs.
 * Run: node hooks/client/native/android-hosts.test.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))

function read(name) {
  return fs.readFileSync(path.join(dir, name), 'utf8')
}

function exportFns(src) {
  return [...src.matchAll(/export function (\w+)/g)].map((m) => m[1]).sort()
}

function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '')
}

function forbidHostOnly(name, src) {
  const code = codeOnly(src)
  assert.equal(code.includes('document'), false, `${name} must not use document`)
  assert.equal(code.includes('window'), false, `${name} must not use window`)
  assert.equal(code.includes('?.'), false, `${name} must not use optional chaining`)
  assert.equal(/['"][^'"]*\.host\.js['"]/.test(code), false, `${name} must not import a web host`)
  assert.equal(/['"][^'"]*\.web\.js['"]/.test(code), false, `${name} must not import a web file`)
}

const stub = read('Affirmation.js')
const affirmation = read('Affirmation.android.js')
const nowShowing = read('NowShowing.android.js')
const theater = read('TheaterPlayer.android.js')

assert.deepEqual(exportFns(affirmation), exportFns(stub), 'android affirmation exports match the stub')
assert.match(stub, /globalThis\.__relaySkipAffirmations === true/)
assert.match(affirmation, /relaySkipAffirmations === true/)
assert.match(affirmation, /globalThis\.__relaySkipAffirmations === true/)
assert.match(affirmation, /return null/)
assert.match(affirmation, /flashback\.ownershipAck\.v1/)
assert.match(affirmation, /flashback\.movieOwn\.v1\./)
assert.match(affirmation, /linksJson/)
assert.match(affirmation, /<a /)
assert.match(affirmation, /localStorage\.setItem/)

assert.match(nowShowing, /data-relay-scroll="x"/)
assert.match(nowShowing, /<a /)
assert.match(nowShowing, /href=/)
assert.equal(/lcd|marquee/i.test(nowShowing), false, 'android now-showing is a row, not the web marquee')

assert.match(theater, /from '@clevertree\/video'/)
assert.match(theater, /<VideoPlayer/)
assert.match(theater, /relayAssetStatus=1/)
assert.match(theater, /p\.unlocked/)
assert.match(theater, /playing=\{p\.playing === true\}/)
assert.match(theater, /command=\{p\.command\}/)
assert.match(theater, /commandSeq=\{p\.commandSeq\}/)
assert.match(theater, /p\.cid/)
assert.match(theater, /srcMobile/)
assert.match(theater, /srcWeb/)
assert.match(theater, /srcMaster/)
assert.match(theater, /subtitlesJson/)
assert.match(theater, /androidSrcLadder|pickSeededSrc/)
assert.match(theater, /Download the movie/)
assert.match(theater, /Full quality \(MKV\)/)
// MKV master is preferred before MP4 fallbacks
assert.match(theater, /master\.length > 0/)

for (const [name, src] of [
  ['Affirmation.android.js', affirmation],
  ['NowShowing.android.js', nowShowing],
  ['TheaterPlayer.android.js', theater],
]) {
  forbidHostOnly(name, src)
}

console.log('android-hosts.test.mjs OK')
