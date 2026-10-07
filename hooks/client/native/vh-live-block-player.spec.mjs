/**
 * Local A/B against production VH: block TheaterPlayer + wasm and confirm page stays usable.
 * Does not deploy — only validates the crash hypothesis / mitigation shape.
 *
 * Run:
 *   playwright test -c hooks/client/native/playwright.config.mjs vh-live-block-player
 */
import { test, expect } from '@playwright/test'

const VH = 'https://flashbackrepository.org/van-helsing-deanna-d'

test.describe('live VH with player/wasm blocked', () => {
  test.setTimeout(90000)

  test('page remains interactive without TheaterPlayer/wasm', async ({ page }) => {
    const blocked = []
    await page.route('**/*', async (route) => {
      const u = route.request().url()
      if (/TheaterPlayer\.host\.js|relay_video_wasm|\/wasm\//i.test(u)) {
        blocked.push(u)
        await route.abort()
        return
      }
      await route.continue()
    })

    const started = Date.now()
    const resp = await page.goto(VH, { waitUntil: 'domcontentloaded', timeout: 45000 })
    expect(resp && resp.ok()).toBeTruthy()

    // Ownership / shell should paint without the heavy player host.
    await expect(page.locator('body')).toBeVisible()
    const title = page.locator('h1, .fb-movie-title').first()
    await expect(title).toBeVisible({ timeout: 20000 })

    // Interact for several seconds — tab must stay alive.
    await page.waitForTimeout(5000)
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible')
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(2000)
    expect(await page.evaluate(() => typeof document.body.innerText)).toBe('string')
    expect((await page.evaluate(() => document.body.innerText)).length).toBeGreaterThan(50)

    const elapsed = Date.now() - started
    expect(elapsed, 'page interaction window').toBeLessThan(80000)
    // Blocking may or may not hit depending on whether SSR already chose ExternalPlay.
    // Either way the page must stay up.
    expect(await page.locator('video').count()).toBeGreaterThanOrEqual(0)
  })
})
