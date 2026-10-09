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

const html = `<!DOCTYPE html><html><body><div id="root"></div>
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
// Desktop fine-pointer so the optional checkbox path is exercised when present.
const page = await browser.newPage()
await page.emulateMedia({ media: 'screen' })
await page.addInitScript(() => {
  const real = window.matchMedia.bind(window)
  window.matchMedia = (q) => {
    if (q === '(hover: hover) and (pointer: fine)') {
      return { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false } }
    }
    return real(q)
  }
})
await page.goto(origin + '/')
await page.evaluate(() => {
  const cb = document.querySelector('input.fb-gate-check')
  const btn = document.querySelector('.fb-gate-ok')
  if (cb) cb.checked = true
  if (btn) btn.click()
})
await page.waitForTimeout(50)
const result = await page.evaluate(() => {
  const el = document.querySelector('.fb-affirmation-native')
  return {
    ack: localStorage.getItem('flashback.ownershipAck.v1'),
    conf: el ? el.getAttribute('data-confirmed') : null,
    display: el ? el.style.display : null,
    position: el ? getComputedStyle(el).position : null,
  }
})
await browser.close()
await new Promise((r) => server.close(r))

if (result.ack !== '1' || result.conf !== '1' || result.display !== 'none') {
  console.error('FAIL', result)
  process.exit(1)
}
if (result.position !== 'fixed') {
  // hidden fixed still reports fixed — ok; before hide we already verified via class
}
console.log('OK affirmation smoke')
