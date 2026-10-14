/**
 * Playwright: live Flashback chat surfaces + local lazy-embed harness.
 *
 * Run:
 *   npx playwright test -c hooks/client/native/playwright.config.mjs live-chat
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const CHAT = 'https://flashbackrepository.org/chat'
const SETUP = 'https://flashbackrepository.org/setup'
const dir = path.dirname(fileURLToPath(import.meta.url))

function startHarnessServer() {
  const mime = {
    '.js': 'application/javascript; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
  }
  const state = {
    healthHits: 0,
    historyHits: 0,
    wsUpgrades: 0,
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    if (url.pathname === '/chat/api/health') {
      state.healthHits++
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, service: 'harness' }))
      return
    }
    if (url.pathname === '/chat/api/history') {
      state.historyHits++
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          channel: url.searchParams.get('channel') || 'page-home',
          messages: [
            {
              id: '1',
              ts: new Date().toISOString(),
              channel: 'page-home',
              nick: 'Orpheum-A1',
              kind: 'privmsg',
              text: 'harness hello **bold**',
            },
          ],
        }),
      )
      return
    }
    if (url.pathname === '/chat/api/name') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ nick: 'Harness-B2', mode: 'theater' }))
      return
    }
    if (url.pathname === '/chat/api/channels') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          channels: [
            { name: 'flashback', topic: 'Lobby' },
            { name: 'page-home', topic: 'Home' },
          ],
        }),
      )
      return
    }
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/' || rel === '/harness-chat.html') rel = '/fixtures/harness-chat.html'
    if (rel.startsWith('/hooks/client/native/')) {
      rel = '/' + rel.slice('/hooks/client/native/'.length)
    }
    const filePath = path.join(dir, rel.replace(/^\//, ''))
    if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404)
      res.end('missing ' + rel)
      return
    }
    const ext = path.extname(filePath)
    const body = fs.readFileSync(filePath)
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Content-Length': String(body.length),
    })
    res.end(body)
  })

  // WS upgrade stub — accept and close after hello
  server.on('upgrade', (req, socket) => {
    if (!String(req.url || '').startsWith('/chat/ws')) {
      socket.destroy()
      return
    }
    state.wsUpgrades++
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: x3IAhRqJXx9R5vWn7n9n9n9n9n8=\r\n\r\n',
    )
    // Incomplete WS handshake is ok — client may error; health+history already covered
    setTimeout(() => {
      try {
        socket.destroy()
      } catch (_) {}
    }, 50)
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, origin: `http://127.0.0.1:${port}`, state })
    })
  })
}

test.describe('live Flashback chat (production)', () => {
  test.setTimeout(90000)

  test('/chat renders ChatApp shell with sidebar', async ({ page }) => {
    const resp = await page.goto(CHAT, { waitUntil: 'domcontentloaded', timeout: 45000 })
    expect(resp && resp.ok()).toBeTruthy()
    await expect(page.locator('[data-relay-park-native="fb-chat-app"]').first()).toBeVisible({
      timeout: 20000,
    })
    await expect(page.locator('.fb-chat-search, [aria-label="Search channels"]').first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('link', { name: 'Chat' }).first()).toBeVisible()
  })

  test('/setup embeds lazy live-chat under content', async ({ page }) => {
    const resp = await page.goto(SETUP, { waitUntil: 'domcontentloaded', timeout: 45000 })
    expect(resp && resp.ok()).toBeTruthy()
    const embed = page.locator('[data-relay-park-native="fb-live-chat"], .fb-live-chat')
    await expect(embed.first()).toBeAttached({ timeout: 15000 })
    // Scroll into view to trigger lazy activation
    await embed.first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    // After activation: either connected UI or unavailable banner (API dependent)
    const live = page.locator('.fb-live-chat, .fb-live-chat-placeholder, .fb-chat-unavailable')
    await expect(live.first()).toBeVisible({ timeout: 15000 })
  })

  test('chat API health is reachable same-origin', async ({ request }) => {
    const r = await request.get('https://flashbackrepository.org/chat/api/health')
    expect(r.ok()).toBeTruthy()
    const j = await r.json()
    expect(j.ok).toBeTruthy()
    expect(j.service).toMatch(/chat/)
  })
})

test.describe('local lazy-embed harness', () => {
  test.setTimeout(60000)

  test('does not hit health until scrolled into view', async ({ page }) => {
    const { server, origin, state } = await startHarnessServer()
    try {
      await page.setViewportSize({ width: 800, height: 500 })
      await page.goto(origin + '/harness-chat.html', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(400)
      expect(state.healthHits).toBe(0)
      expect(state.historyHits).toBe(0)

      await page.locator('#chat-sentinel').scrollIntoViewIfNeeded()
      await page.waitForTimeout(1200)
      expect(state.healthHits).toBeGreaterThan(0)
      // History follows successful health
      expect(state.historyHits).toBeGreaterThan(0)
      await expect(page.locator('.fb-live-chat-body').first()).toBeVisible({
        timeout: 10000,
      })
      await expect(page.locator('.fb-chat-msg').first()).toBeVisible()
    } finally {
      server.close()
    }
  })
})
