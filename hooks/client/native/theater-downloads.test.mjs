/**
 * Smoke: TheaterPlayer host ships calm download row + collapsible tech details.
 * Run: node --test hooks/client/native/theater-downloads.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const host = fs.readFileSync(path.join(dir, 'TheaterPlayer.host.js'), 'utf8')
const common = fs.readFileSync(path.join(dir, 'park-host-common.js'), 'utf8')

test('host builds download row with MKV and resolution labels', () => {
  assert.match(host, /function buildDownloadRow/)
  assert.match(host, /Download the movie/)
  assert.match(host, /Full quality \(MKV\)/)
  assert.match(host, /1080p \(MP4\)/)
  assert.match(host, /720p \(MP4\)/)
  assert.match(host, /buildDownloadRow\(props, srcLadder\)/)
})

test('error and pending UI keep tech details behind a toggle', () => {
  assert.match(host, /Technical details/)
  assert.match(host, /fb-theater-tech/)
  assert.match(host, /Sorry — this browser couldn’t play the video/)
  assert.match(host, /You can download the movie below and open it on your computer/)
  assert.match(host, /Getting the movie ready/)
  assert.match(common, /\.fb-theater-downloads/)
  assert.match(common, /\.fb-theater-tech/)
})
