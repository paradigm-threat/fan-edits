/**
 * Heuristic / wiring tests for Flashback live chat.
 * Run: node --test hooks/client/native/live-chat.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(dir, '../../..')

function read(...parts) {
  return fs.readFileSync(path.join(...parts), 'utf8')
}

const getJsx = read(root, 'hooks/client/get.jsx')
const validation = read(root, 'hooks/server/validation.cs')
const liveHost = read(dir, 'LiveChat.host.js')
const chatApp = read(dir, 'ChatApp.host.js')
const common = read(dir, 'ChatCommon.host.js')
const liveStub = read(dir, 'LiveChat.js')
const appStub = read(dir, 'ChatApp.js')
const inject = read(dir, 'inject-park-hosts.test.mjs')
const apkDoc = read(root, 'docs/ANDROID_APK.md')

test('get.jsx routes /chat and mounts LiveChat under main', () => {
  assert.match(getJsx, /route === '\/chat'/)
  assert.match(getJsx, /from 'hooks\/client\/native\/LiveChat\.js'/)
  assert.match(getJsx, /from 'hooks\/client\/native\/ChatApp\.js'/)
  assert.match(getJsx, /kind\.kind !== 'chat'/)
  assert.match(getJsx, /<LiveChat /)
  assert.match(getJsx, /<ChatApp /)
  assert.match(getJsx, /href="\/chat"/)
  assert.match(getJsx, /chatChannelForRoute/)
  // CleverScript-safe: no regex literals in chat helpers
  assert.doesNotMatch(getJsx, /chatChannelForRoute[\s\S]{0,800}\/\[/)
  assert.doesNotMatch(getJsx, /stripLeadingHash[\s\S]{0,200}String\(/)
})

test('LiveChat stub uses park-native fb-live-chat', () => {
  assert.match(liveStub, /data-relay-park-native="fb-live-chat"/)
  assert.match(liveStub, /data-channel/)
})

test('ChatApp stub uses park-native fb-chat-app', () => {
  assert.match(appStub, /data-relay-park-native="fb-chat-app"/)
})

test('LiveChat.host lazy-activates via IntersectionObserver + health', () => {
  assert.match(liveHost, /IntersectionObserver/)
  assert.match(liveHost, /rootMargin/)
  assert.match(liveHost, /healthCheck/)
  assert.match(liveHost, /fetchHistory/)
  assert.match(liveHost, /connectChat/)
  assert.match(liveHost, /Open full chat/)
  assert.match(liveHost, /\/chat\?c=/)
})

test('ChatApp.host has sidebar search and IRC-ish commands', () => {
  assert.match(chatApp, /fb-chat-search/)
  assert.match(chatApp, /fetchChannels/)
  assert.match(chatApp, /\/me |\/join |\/part/)
  assert.match(chatApp, /fb-chat-names/)
  assert.match(chatApp, /switchChannel/)
})

test('ChatCommon has markdown, nick storage, ws path', () => {
  assert.match(common, /flashback\.chat\.nick\.v1/)
  assert.match(common, /renderMd/)
  assert.match(common, /\/chat\/ws/)
  assert.match(common, /\/chat\/api\/health/)
  assert.match(common, /channelFromPath/)
  assert.match(common, /movie-/)
})

test('validation allows ops/chat paths', () => {
  assert.match(validation, /ops\/chat\//)
})

test('ANDROID_APK documents simple Custom Tab chat path', () => {
  assert.match(apkDoc, /\/chat/)
  assert.match(apkDoc, /Custom Tab|WebView|browser/i)
  assert.match(apkDoc, /web-only|no native IRC/i)
})

test('inject-park-hosts fixture still documents Board; chat added via gateway', () => {
  assert.match(inject, /Board\.host\.js/)
  // Chat hosts are injected by relay-gateway embed_html when placeholders present
  const embed = read(
    '/home/ari/dev/relay/relay-gateway/src/git/embed_html.rs',
  )
  assert.match(embed, /LiveChat\.host\.js/)
  assert.match(embed, /ChatApp\.host\.js/)
  assert.match(embed, /ChatCommon\.host\.js/)
  assert.match(embed, /fb-live-chat/)
  assert.match(embed, /fb-chat-app/)
})
