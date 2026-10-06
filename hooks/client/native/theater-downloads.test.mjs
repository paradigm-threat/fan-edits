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

test('host builds download row with HEVC MP4, resolution, and subtitle labels', () => {
  assert.match(host, /function buildDownloadRow/)
  assert.match(host, /Download the movie/)
  assert.match(host, /Full quality \(HEVC MP4\)/)
  assert.match(host, /1080p \(H\.264 MP4\)/)
  assert.match(host, /720p \(H\.264 MP4\)/)
  assert.match(host, /Subtitles \(default\)/)
  assert.match(host, /Subtitles \(enhanced\)/)
  assert.match(host, /subtitlesJson/)
  assert.match(host, /buildDownloadRow\(props, srcLadder\)/)
})

test('error and pending UI keep tech details behind a toggle', () => {
  assert.match(host, /Technical details/)
  assert.match(host, /fb-theater-tech/)
  assert.match(host, /Getting the movie ready/)
  assert.match(common, /\.fb-theater-downloads/)
  assert.match(common, /\.fb-theater-tech/)
})
