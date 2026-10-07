/**
 * Local validation of SSR-static mode: strip CleverScript embed.js from live VH
 * document + block hydrate chunks. Park-native hosts alone must keep the page usable.
 *
 * Run:
 *   npx playwright test -c hooks/client/native/playwright.config.mjs ssr-static-no-hydrate
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VH = 'https://flashbackrepository.org/van-helsing-deanna-d'
const MUMMY = 'https://flashbackrepository.org/the-mummy-1999-debugged'
const nativeDir = path.dirname(fileURLToPath(import.meta.url))
const localExternalPlayHost = fs.readFileSync(path.join(nativeDir, 'ExternalPlay.host.js'), 'utf8')

function stripEmbedJs(html) {
  let out = String(html)
  // Remove <script type="module" … embed.js …></script>
  out = out.replace(
    /<script\b[^>]*\bsrc=["'][^"']*embed\.js[^"']*["'][^>]*>\s*<\/script>/gi,
    '',
  )
  out = out.replace(/data-pt-hydrated=["']0["']/, 'data-pt-hydrated="1"')
  return out
}

async function gotoStaticSsr(page, url) {
  const blocked = []
  await page.route('**/*', async (route) => {
    const req = route.request()
    const u = req.url()
    if (req.resourceType() === 'document' && (u === url || u.startsWith(url + '?'))) {
      const resp = await route.fetch()
      let body = await resp.text()
      body = stripEmbedJs(body)
      const headers = { ...resp.headers() }
      delete headers['content-encoding']
      delete headers['content-length']
      await route.fulfill({
        status: resp.status(),
        headers,
        body,
      })
      return
    }
    // Local fix: ExternalPlay MutationObserver must not re-enter on attr writes.
    if (/ExternalPlay\.host\.js/i.test(u)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: localExternalPlayHost,
      })
      return
    }
    if (/\/embed\.js|bootEmbedRoot|chunk-[A-Z0-9]+\.js|relay-runtime-web/i.test(u)) {
      blocked.push(u)
      await route.abort()
      return
    }
    if (/TheaterPlayer\.host\.js|relay_video_wasm|\/wasm\//i.test(u)) {
      blocked.push(u)
      await route.abort()
      return
    }
    await route.continue()
  })
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  return { resp, blocked }
}

test.describe('SSR-static (no CleverScript hydrate)', () => {
  test.setTimeout(120000)

  test('VH stays responsive without embed.js; Affirmation unlocks ExternalPlay', async ({
    page,
  }) => {
    const { resp, blocked } = await gotoStaticSsr(page, VH)
    expect(resp && resp.ok()).toBeTruthy()

    // Document must not request CleverScript hydrate after strip.
    expect(blocked.some((u) => /embed\.js/.test(u))).toBeFalsy()

    await expect(page.locator('.fb-movie-title, h1').first()).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-relay-park-native="fb-external-play"], .fb-external-play').first()).toBeVisible({
      timeout: 15000,
    })

    // Stay interactive ≥10s (hang repro window).
    await page.waitForTimeout(10000)
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible')
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(1000)
    const textLen = await page.evaluate(() => (document.body && document.body.innerText) || '')
    expect(textLen.length).toBeGreaterThan(80)

    // No CleverScript script tag left in the document.
    expect(await page.locator('script[src*="embed.js"]').count()).toBe(0)

    // Affirmation → unlock (park host). Prefer in-page click; force attrs if needed.
    await page.evaluate(async () => {
      const host = document.querySelector(
        '[data-relay-park-native="fb-affirmation"][data-mode="title"]',
      )
      if (!host) throw new Error('missing title affirmation')
      const box = host.querySelector('input[type="checkbox"]')
      const btn = host.querySelector('button.fb-gate-ok')
      if (box) box.checked = true
      if (btn) btn.click()
      // Allow MutationObserver / unlock sync a turn.
      await new Promise((r) => setTimeout(r, 50))
    })
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.getAttribute('data-fb-welcome-ack')),
      )
      .toBe('1')
    expect(
      await page.evaluate(() =>
        document.querySelector('.fb-external-play')?.getAttribute('data-fb-unlocked'),
      ),
    ).toBe('true')

    // Nav must be real links (full page load OK in static mode).
    const libraryHref = await page.locator('nav.fb-nav a, a.fb-brand').first().getAttribute('href')
    expect(libraryHref).toMatch(/\/$|flashbackrepository\.org\/?$/)
  })

  test('Mummy page also stays responsive without hydrate', async ({ page }) => {
    const { resp } = await gotoStaticSsr(page, MUMMY)
    expect(resp && resp.ok()).toBeTruthy()
    await expect(page.locator('.fb-movie-title, h1').first()).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(8000)
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible')
    expect((await page.evaluate(() => document.body.innerText)).length).toBeGreaterThan(40)
  })
})
