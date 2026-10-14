/**
 * Playwright: Now Showing carousel crossfade (one old→new fade, no double flash).
 * Run: npx playwright test -c hooks/client/native/playwright.config.mjs now-showing-carousel
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))

function startStaticServer() {
  const mime = {
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.svg': 'image/svg+xml',
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/') rel = '/fixtures/now-showing-carousel.html'
    if (rel.startsWith('/hooks/client/native/')) {
      rel = rel.slice('/hooks/client/native'.length)
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
      'Cache-Control': 'no-store',
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

test.describe('Now Showing carousel crossfade', () => {
  /** @type {{ server: import('node:http').Server, origin: string }} */
  let srv

  test.beforeAll(async () => {
    srv = await startStaticServer()
  })

  test.afterAll(async () => {
    await new Promise((r) => srv.server.close(r))
  })

  test('one crossfade: both layers mid-fade; no second fade-in after settle', async ({
    page,
  }) => {
    await page.goto(srv.origin + '/fixtures/now-showing-carousel.html', {
      waitUntil: 'domcontentloaded',
    })
    await expect(page.locator('.fb-slideshow-layer.is-active')).toHaveCount(1)
    await expect(
      page.locator('.fb-slideshow-layer.is-active .fb-slideshow-title'),
    ).toContainText('Mummy (1999)')

    // Park CSS must be current (no visibility:hidden on inactive layers).
    const cssId = await page.evaluate(() => {
      const st = document.getElementById('fb-park-native-css-v11')
      return st ? st.id : null
    })
    expect(cssId).toBe('fb-park-native-css-v11')
    const hasVisHidden = await page.evaluate(() => {
      const st = document.getElementById('fb-park-native-css-v11')
      return st ? /visibility\s*:\s*hidden/.test(st.textContent || '') : true
    })
    expect(hasVisHidden).toBe(false)

    const trace = await page.evaluate(async () => {
      const next = document.querySelector('.fb-slideshow-next')
      const layers = Array.from(document.querySelectorAll('.fb-slideshow-layer'))
      const samples = []
      const t0 = performance.now()
      next.click()
      while (performance.now() - t0 < 2400) {
        samples.push({
          t: Math.round(performance.now() - t0),
          layers: layers.map((el) => ({
            op: Math.round(parseFloat(getComputedStyle(el).opacity) * 1000) / 1000,
            active: el.classList.contains('is-active'),
            title: (el.querySelector('.fb-slideshow-title') || {}).textContent || '',
          })),
        })
        await new Promise((r) => setTimeout(r, 40))
      }
      return samples
    })

    expect(trace.length).toBeGreaterThan(10)

    // Mid-crossfade window: both layers should be partially visible.
    const mid = trace.filter((s) => s.t >= 250 && s.t <= 900)
    expect(mid.length).toBeGreaterThan(3)
    const sawBothVisible = mid.some((s) => {
      const ops = s.layers.map((l) => l.op)
      return ops[0] > 0.12 && ops[1] > 0.12
    })
    expect(sawBothVisible).toBe(true)

    // Count fade-ins for the incoming title (Mummy Returns): rising edges low→high.
    const incomingTitle = 'The Mummy Returns (2001) — Debugged'
    let riseCount = 0
    let wasLow = true
    for (const s of trace) {
      const layer = s.layers.find((l) => l.title === incomingTitle)
      if (!layer) continue
      if (wasLow && layer.op > 0.85) {
        riseCount += 1
        wasLow = false
      }
      if (layer.op < 0.2) wasLow = true
    }
    expect(riseCount).toBe(1)

    // Settled: exactly one active layer at full opacity.
    const last = trace[trace.length - 1]
    const active = last.layers.filter((l) => l.active)
    expect(active).toHaveLength(1)
    expect(active[0].op).toBeGreaterThan(0.95)
    expect(active[0].title).toContain('Mummy Returns')
  })
})
