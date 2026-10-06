/**
 * Smoke: TheaterPlayer host ships external-stream CTA + download row.
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

test('host builds external watch panel with VLC stream copy', () => {
  assert.match(host, /function buildExternalWatchPanel/)
  assert.match(host, /Watch in an external player/)
  assert.match(host, /Copy stream URL/)
  assert.match(host, /Get VLC/)
  assert.match(host, /videolan\.org\/vlc/)
  assert.match(host, /Open Network Stream/)
  assert.match(host, /data-playback-engine/)
  assert.match(host, /data-fb-external-watch/)
})

test('host builds download row with MKV master and subtitle labels', () => {
  assert.match(host, /function buildDownloadRow/)
  assert.match(host, /Download the movie/)
  assert.match(host, /Full quality \(MKV\)/)
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
  assert.match(common, /\.fb-theater-external/)
  assert.match(common, /\.fb-theater-tech/)
})

test('library masters skip WASM escalate and prefer external stream', () => {
  assert.match(host, /isLibraryMaster/)
  assert.match(host, /__setStreamUrl/)
  assert.doesNotMatch(
    host.slice(host.indexOf('function showReady')),
    /mountWasmPlayer\(mediaUrl/,
  )
})

test('host arms play-start and buffer-stall timeouts', () => {
  assert.match(host, /PLAY_START_TIMEOUT_MS/)
  assert.match(host, /BUFFER_STALL_TIMEOUT_MS/)
  assert.match(host, /play_start_timeout/)
  assert.match(host, /buffer_stall_timeout/)
  assert.match(host, /armPlayStartWatch/)
  assert.match(host, /failPlaybackStall/)
})
