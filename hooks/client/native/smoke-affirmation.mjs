/**
 * Headless smoke for Affirmation.web.js without Playwright package.
 * node hooks/client/native/smoke-affirmation.mjs
 */
import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const host = fs.readFileSync(path.join(dir, 'Affirmation.web.js'), 'utf8')

const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() =>
  chromium.launch({ headless: true }),
)
const page = await browser.newPage()
await page.setContent(`<!DOCTYPE html><html><body><div id="root"></div>
<script>${host}</script>
<script>
  const root = document.getElementById('root');
  root.appendChild(window.__fbBuildAffirmation({
    mode: 'welcome', title: 'Test', checkboxLabel: 'I confirm', confirmLabel: 'OK',
    storageKey: 'flashback.ownershipAck.v1', confirmed: 'false', linksJson: '[]',
  }, () => {}, null));
</script></body></html>`)
await page.locator('.fb-gate-check').check()
await page.locator('.fb-gate-ok').click()
const ack = await page.evaluate(() => localStorage.getItem('flashback.ownershipAck.v1'))
const conf = await page.locator('.fb-affirmation-native').getAttribute('data-confirmed')
await browser.close()
if (ack !== '1' || conf !== '1') {
  console.error('FAIL', { ack, conf })
  process.exit(1)
}
console.log('OK affirmation smoke')
