/**
 * Headless smoke for Affirmation.host.js.
 * node hooks/client/native/smoke-affirmation.mjs
 */
import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import http from 'http'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const host = fs.readFileSync(path.join(dir, 'Affirmation.host.js'), 'utf8')
const common = fs.readFileSync(path.join(dir, 'park-host-common.js'), 'utf8')

const html = `<!DOCTYPE html><html><body>
<div class="fb-app">
  <header class="fb-header"><button type="button" id="bg">Background</button></header>
  <main class="fb-main"><div id="root"></div></main>
</div>
<script>${common}</script>
<script>${host}</script>
<script>
  const root = document.getElementById('root');
  root.appendChild(window.__fbBuildAffirmation({
    mode: 'welcome', title: 'Test', checkboxLabel: 'I confirm', confirmLabel: 'OK',
    storageKey: 'flashback.ownershipAck.v1', confirmed: 'false', linksJson: '[]',
  }, () => {}, null));
</script></body></html>`

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const { port } = server.address()
const origin = `http://127.0.0.1:${port}`

const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() =>
  chromium.launch({ headless: true }),
)

async function freshPage() {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(origin + '/')
  return { ctx, page }
}

// 1) Confirm still persists.
{
  const { ctx, page } = await freshPage()
  await page.evaluate(() => {
    const cb = document.querySelector('input.fb-gate-check')
    const btn = document.querySelector('.fb-gate-ok')
    if (cb) cb.checked = true
    // Element.click() skips pointerdown early-persist; exercises doConfirm fully.
    if (btn) btn.click()
  })
  await page.waitForTimeout(50)
  const result = await page.evaluate(() => {
    const el = document.querySelector('.fb-affirmation-native')
    return {
      ack: localStorage.getItem('flashback.ownershipAck.v1'),
      conf: el ? el.getAttribute('data-confirmed') : null,
      display: el ? el.style.display : null,
      inert: !!document.querySelector('.fb-header[inert], .fb-main[inert]'),
    }
  })
  await ctx.close()
  if (result.ack !== '1' || result.conf !== '1' || result.display !== 'none' || result.inert) {
    console.error('FAIL confirm', result)
    process.exit(1)
  }
}

// 2) Background use hides without storing.
{
  const { ctx, page } = await freshPage()
  await page.locator('#bg').click()
  await page.waitForTimeout(50)
  const result = await page.evaluate(() => {
    const el = document.querySelector('.fb-affirmation-native')
    return {
      ack: localStorage.getItem('flashback.ownershipAck.v1'),
      dismissed: el ? el.getAttribute('data-fb-session-dismissed') : null,
      display: el ? el.style.display : null,
      inert: !!document.querySelector('.fb-header[inert], .fb-main[inert]'),
    }
  })
  await ctx.close()
  if (result.ack != null || result.dismissed !== '1' || result.display !== 'none' || result.inert) {
    console.error('FAIL background dismiss', result)
    process.exit(1)
  }
}

await browser.close()
await new Promise((r) => server.close(r))
console.log('OK affirmation smoke')
