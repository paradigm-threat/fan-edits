/**
 * Smoke: board host + validation comments allowlist.
 * Run: node --test hooks/client/native/board-comments.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(dir, '../../..')
const host = fs.readFileSync(path.join(dir, 'Board.host.js'), 'utf8')
const validation = fs.readFileSync(path.join(root, 'hooks/server/validation.cs'), 'utf8')
const getJsx = fs.readFileSync(path.join(root, 'hooks/client/get.jsx'), 'utf8')

test('board host posts to comments branch under .relay/comments', () => {
  assert.match(host, /var BRANCH = 'comments'/)
  assert.match(host, /'X-Relay-Branch': BRANCH/)
  assert.match(host, /\.relay\/comments\/by-path\//)
  assert.match(host, /encodeCommentTargetPath/)
  assert.match(host, /httpUrlForRepoPath/)
  assert.match(host, /encodeURIComponent\(encodeURIComponent/)
  assert.match(host, /Post publicly/)
})

test('theater links report flow to /board', () => {
  const theater = fs.readFileSync(path.join(dir, 'TheaterPlayer.host.js'), 'utf8')
  assert.match(theater, /\/board\?kind=bug/)
  assert.match(theater, /goToBoardBug/)
})

test('validation gates comments paths by branch', () => {
  assert.match(validation, /COMMENTS_PREFIX/)
  assert.match(validation, /branch !== 'comments'/)
  assert.match(validation, /COMMENTS_MAX_BYTES/)
  assert.match(validation, /\.relay\/comments\/by-path\//)
  assert.match(validation, /ctx\.branch \? '' \+ ctx\.branch/)
})

test('get.jsx routes /board and links Board', () => {
  assert.match(getJsx, /route === '\/board'/)
  assert.match(getJsx, /from 'hooks\/client\/native\/Board\.js'/)
  assert.match(getJsx, /Board \/ Report a problem/)
})
