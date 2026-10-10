/**
 * Local validation: ExternalPlay-only path (TheaterPlayer/WASM not loaded).
 * Run: playwright test -c hooks/client/native/playwright.config.mjs hooks/client/native/external-only.spec.mjs
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const STREAM = 'https://flashbackrepository.org/FanMixes/Van%20Helsing%20-%20DeAnna%27d/Van%20Helsing%20-%20DeAnna%27d.mkv'

function startStaticServer() {
  const mime = {
    '.js': 'application/javascript; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/') rel = '/external-only-harness.html'
    if (rel.startsWith('/hooks/client/native/')) {
      rel = rel.slice('/hooks/client/native'.length)
    }
    const filePath = path.join(dir, rel.replace(/^\//, ''))
    if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404)
      res.end('missing')
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
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, origin: `http://127.0.0.1:${port}` })
    })
  })
}

const harnessHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ExternalPlay-only harness</title>
  <style>
    body { margin: 0; background: #0d0505; color: #f5e6be; font-family: Georgia, serif; }
    .fb-video-panel { margin: 24px; border: 1px solid #3a2a1a; padding: 12px; }
  </style>
</head>
<body>
  <h1>Van Helsing — DeAnna'd (local external-only)</h1>
  <div class="fb-video-panel" id="panel"></div>
  <script src="/hooks/client/native/park-host-common.js"></script>
  <script src="/hooks/client/native/ExternalPlay.host.js"></script>
  <script>
    const panel = document.getElementById('panel');
    const built = window.__fbBuildExternalPlay({
      streamUrl: ${JSON.stringify(STREAM)},
      unlocked: 'true',
      setupHref: '/setup',
    }, null);
    panel.appendChild(built);
  </script>
</body>
</html>
`

test.describe('external-only (no TheaterPlayer)', () => {
  /** @type {{ server: import('http').Server, origin: string }} */
  let srv
  const harnessPath = path.join(dir, 'external-only-harness.html')

  test.beforeAll(async () => {
    fs.writeFileSync(harnessPath, harnessHtml)
    srv = await startStaticServer()
  })

  test.afterAll(async () => {
    await new Promise((r) => srv.server.close(r))
    try {
      fs.unlinkSync(harnessPath)
    } catch (_) {}
  })

  test('renders VLC/external UI without video or wasm', async ({ page }) => {
    const wasmHits = []
    const theaterHits = []
    page.on('request', (req) => {
      const u = req.url()
      if (/wasm|relay_video_wasm/i.test(u)) wasmHits.push(u)
      if (/TheaterPlayer\.host\.js/i.test(u)) theaterHits.push(u)
    })

    const consoleErrors = []
    page.on('pageerror', (err) => consoleErrors.push(String(err)))
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto(srv.origin + '/external-only-harness.html', { waitUntil: 'domcontentloaded' })

    const external = page.locator('[data-fb-external-play="1"]')
    await expect(external).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /Open in VLC/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Open stream link/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Copy stream URL/i })).toBeVisible()
    const streamA = page.locator('a.fb-theater-external-url[data-fb-stream-url="1"]')
    await expect(streamA).toBeVisible()
    await expect(streamA).toHaveAttribute('href', STREAM)
    await expect(page.locator('video')).toHaveCount(0)
    await expect(page.locator('.fb-theater-player')).toHaveCount(0)

    // Stay interactive for a few seconds (crash/lag regression smoke).
    await page.waitForTimeout(3000)
    await expect(external).toBeVisible()
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible')
    expect(await page.evaluate(() => typeof window.__fbBuildTheaterPlayer)).toBe('undefined')
    expect(await page.evaluate(() => typeof window.__fbBuildExternalPlay)).toBe('function')

    expect(theaterHits, 'TheaterPlayer.host.js must not load').toEqual([])
    expect(wasmHits, 'wasm player assets must not load').toEqual([])
    expect(consoleErrors, 'no page errors').toEqual([])
  })
})
