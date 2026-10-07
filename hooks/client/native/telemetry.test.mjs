/**
 * Unit tests for theater RUM telemetry helpers.
 * Run: node --test hooks/client/native/telemetry.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const telemetry = require(path.join(__dirname, 'telemetry.js'))

test('reportTheaterIssue posts major always', () => {
  const posts = []
  const g = globalThis
  const prevFetch = g.fetch
  const prevBeacon = g.navigator && g.navigator.sendBeacon
  g.fetch = (url, opts) => {
    posts.push({ url, body: opts && opts.body })
    return Promise.resolve({ ok: true })
  }
  if (g.navigator) {
    g.navigator.sendBeacon = () => false
  }
  try {
    telemetry.reportTheaterIssue({
      severity: 'major',
      code: 'wasm_hard_fail',
      message: 'Full quality needs hardware decode',
      rendition: 'master',
      engine: 'wasm',
      path: '/van-helsing-deanna-d',
      force: true,
    })
    assert.equal(posts.length, 1)
    assert.equal(posts[0].url, '/api/rum')
    const body = JSON.parse(posts[0].body)
    assert.equal(body.kind, 'theater')
    assert.equal(body.severity, 'major')
    assert.equal(body.code, 'wasm_hard_fail')
    assert.equal(body.path, '/van-helsing-deanna-d')
  } finally {
    g.fetch = prevFetch
    if (g.navigator && prevBeacon !== undefined) {
      g.navigator.sendBeacon = prevBeacon
    }
  }
})

test('reportTheaterIssue skips when code missing', () => {
  const posts = []
  const g = globalThis
  const prevFetch = g.fetch
  g.fetch = (url, opts) => {
    posts.push(opts)
    return Promise.resolve({ ok: true })
  }
  try {
    telemetry.reportTheaterIssue({ severity: 'major' })
    assert.equal(posts.length, 0)
  } finally {
    g.fetch = prevFetch
  }
})
