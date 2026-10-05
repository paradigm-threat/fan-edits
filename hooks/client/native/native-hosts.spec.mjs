/**
 * Isolated Playwright checks for park-native web hosts (no full park boot).
 * Run: npx playwright test hooks/client/native/native-hosts.playwright.mjs
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadHost(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8')
}

test.describe('park native web hosts', () => {
  test('Affirmation: check + OK persists and hides', async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body><div id="root"></div>
<script>${loadHost('Affirmation.host.js')}</script>
<script>
  const root = document.getElementById('root');
  const el = window.__fbBuildAffirmation({
    mode: 'welcome',
    title: 'Test Gate',
    checkboxLabel: 'I confirm',
    confirmLabel: 'OK',
    storageKey: 'flashback.ownershipAck.v1',
    confirmed: 'false',
    linksJson: '[]',
  }, () => {}, null);
  root.appendChild(el);
</script></body></html>`)
    await page.locator('.fb-gate-check').check()
    await page.locator('.fb-gate-ok').click()
    await expect(page.locator('.fb-affirmation-native')).toHaveAttribute('data-confirmed', '1')
    const ack = await page.evaluate(() => localStorage.getItem('flashback.ownershipAck.v1'))
    expect(ack).toBe('1')
  })

  test('NowShowing lcd builds links', async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body><div id="root"></div>
<script>${loadHost('NowShowing.host.js')}</script>
<script>
  const root = document.getElementById('root');
  const el = window.__fbBuildNowShowing({
    variant: 'lcd',
    itemsJson: JSON.stringify([
      { title: 'Alpha', href: '/alpha' },
      { title: 'Beta', href: '/beta' },
    ]),
  });
  root.appendChild(el);
</script></body></html>`)
    await expect(page.locator('a.fb-lcd-link[href="/alpha"]')).toHaveCount(2)
    await expect(page.locator('.fb-marquee-wing-letter').first()).toBeVisible()
  })

  test('TheaterPlayer exposes video when ready', async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body><div id="root"></div>
<script>${loadHost('TheaterPlayer.host.js')}</script>
<script>
  const root = document.getElementById('root');
  const el = window.__fbBuildTheaterPlayer({
    src: 'https://example.com/x.mkv',
    cid: 'bafybeiabc',
    seedState: 'ready',
    unlocked: 'true',
    playing: 'false',
    command: '0',
    commandSeq: '0',
  }, () => {}, null);
  root.appendChild(el);
</script></body></html>`)
    await expect(page.locator('video.fb-media-video')).toHaveCount(1)
    await expect(page.locator('.fb-media-inspect-cid')).toHaveText('bafybeiabc')
  })
})
