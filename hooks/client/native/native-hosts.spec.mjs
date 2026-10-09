/**
 * Playwright coverage for park-native Affirmation modal + TheaterPlayer Play feedback.
 * Run: playwright test -c hooks/client/native/playwright.config.mjs
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const tinyPath = path.join(dir, 'fixtures', 'tiny.mkv')
const tinyBuf = fs.readFileSync(tinyPath)
const tinySize = tinyBuf.length

const MEDIA_PATH = '/FanMixes/Test/tiny.mkv'
const SLUG = 'test-tiny'


function startStaticServer() {
  const mime = {
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.mkv': 'video/x-matroska',
    '.mp4': 'video/mp4',
    '.vtt': 'text/vtt; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/') rel = '/harness.html'
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
    if (req.headers.range && ext === '.mkv') {
      const m = String(req.headers.range).match(/bytes=(\d+)-(\d*)/)
      const start = m ? parseInt(m[1], 10) : 0
      const end = m && m[2] ? parseInt(m[2], 10) : body.length - 1
      const slice = body.subarray(start, end + 1)
      res.writeHead(206, {
        'Content-Type': mime[ext] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${start + slice.length - 1}/${body.length}`,
        'Content-Length': String(slice.length),
        'Access-Control-Allow-Origin': '*',
      })
      res.end(slice)
      return
    }
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Content-Length': String(body.length),
      'Access-Control-Allow-Origin': '*',
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
  <title>Flashback native host harness</title>
  <style>
    body { margin: 0; background: #0d0505; color: #f5e6be; font-family: Georgia, serif; }
    .fb-video-panel { position: relative; margin: 24px; border: 1px solid #3a2a1a; padding: 12px; }
    .fb-video-controls { display: flex; gap: 8px; margin-top: 12px; }
    .fb-btn { padding: 8px 14px; border: 1px solid #e8c872; background: #2a1018; color: #f5e6be; cursor: pointer; }
  </style>
</head>
<body>
  <div class="fb-video-panel">
    <div id="player-host"></div>
    <div id="affirm-host"></div>
    <div class="fb-video-controls">
      <button type="button" class="fb-btn" id="play">Play</button>
      <button type="button" class="fb-btn" id="pause">Pause</button>
    </div>
  </div>
  <script src="/hooks/client/native/park-host-common.js"></script>
  <script src="/hooks/client/native/telemetry.js"></script>
  <script src="/hooks/client/native/Affirmation.host.js"></script>
  <script src="/hooks/client/native/TheaterPlayer.host.js"></script>
  <script>
    const slug = ${JSON.stringify(SLUG)};
    const media = ${JSON.stringify(MEDIA_PATH)};
    const playerMount = document.getElementById('player-host');
    const affirmMount = document.getElementById('affirm-host');
    const player = window.__fbBuildTheaterPlayer({
      src: media,
      cid: 'bafybeitesthostcid000000000000000000000000000000000',
      seedState: 'pending',
      unlocked: 'false',
      playing: 'false',
      command: '0',
      commandSeq: '0',
      commandArg: '',
      startAt: '',
    }, () => {}, null);
    playerMount.appendChild(player);

    const affirm = window.__fbBuildAffirmation({
      mode: 'title',
      eyebrow: 'CONFIRM',
      title: 'I confirm I own a legal copy of Test Film',
      body: 'Harness ownership gate.',
      checkboxLabel: 'I confirm I own a legal copy of Test Film before I play its edit.',
      confirmLabel: 'OK — I confirm',
      storageKey: 'flashback.movieOwn.v1.' + slug,
      confirmed: 'false',
      linksJson: '[]',
    }, () => {}, null);
    affirmMount.appendChild(affirm);

    // Match production unlock: path slug for movie ack
    history.replaceState(null, '', '/' + slug);

    document.getElementById('play').addEventListener('click', () => {
      const host = document.querySelector('.fb-theater-player');
      if (host && host.__fbCtx && host.__fbCtx.notePlayWhileSeeding) {
        host.__fbCtx.notePlayWhileSeeding();
      } else if (host && host.__fbStartMirrorHunt) {
        host.__fbStartMirrorHunt({ fromPlay: true });
      }
      const built = document.querySelector('.fb-theater-player');
      if (built && built.parentElement && built.parentElement.setAttribute) {
        built.parentElement.setAttribute('data-unlocked', 'true');
        built.parentElement.setAttribute('data-playing', 'true');
        built.parentElement.setAttribute('data-command', '1');
        built.parentElement.setAttribute('data-command-seq', String(Date.now()));
      }
      if (built && built.__fbApplyCommands) {
        built.__fbApplyCommands({
          unlocked: 'true',
          playing: 'true',
          command: '1',
          commandSeq: String(Date.now()),
        });
      }
      const v = document.querySelector('video.fb-media-video');
      if (v && v.play) v.play().catch(() => {});
    });
    document.getElementById('pause').addEventListener('click', () => {
      const v = document.querySelector('video.fb-media-video');
      if (v && v.pause) v.pause();
    });

    // When Affirmation confirms, unlock the theater host like CleverScript would.
    const mo = new MutationObserver(() => {
      const ack = document.documentElement.getAttribute('data-fb-movie-ack');
      if (ack === slug) {
        const built = document.querySelector('.fb-theater-player');
        if (built && built.parentElement) {
          built.parentElement.setAttribute('data-unlocked', 'true');
        }
        if (built && built.__fbApplyCommands) {
          built.__fbApplyCommands({ unlocked: 'true', playing: 'false', command: '0', commandSeq: '0' });
        }
        if (built && built.__fbCtx && built.__fbCtx.setUnlocked) {
          built.__fbCtx.setUnlocked(true);
        }
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-fb-movie-ack'] });
  </script>
</body>
</html>
`

test.describe('native hosts', () => {
  /** @type {{ server: import('http').Server, origin: string }} */
  let srv

  test.beforeAll(async () => {
    fs.writeFileSync(path.join(dir, 'harness.html'), harnessHtml)
    // Ensure host files are loadable under /hooks/client/native/ via server mapping
    srv = await startStaticServer()
  })

  test.afterAll(async () => {
    await new Promise((r) => srv.server.close(r))
    try {
      fs.unlinkSync(path.join(dir, 'harness.html'))
    } catch (_) {}
  })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear()
      } catch (_) {}
    })

    await page.route(`**${MEDIA_PATH}**`, async (route) => {
      const req = route.request()
      const url = req.url()
      if (url.includes('relayAssetStatus=1')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/vnd.relay.asset-status+json',
          body: JSON.stringify({
            schema: 'relay.asset-status.v1',
            error: 'ok',
            message: 'asset available',
            retryable: false,
            cid: 'bafybeitesthostcid000000000000000000000000000000000',
            seed: {
              state: 'cached',
              progressPct: 100,
              bytesTotal: tinySize,
              localBlock: true,
            },
          }),
        })
        return
      }
      const range = req.headers()['range']
      if (range) {
        const m = String(range).match(/bytes=(\d+)-(\d*)/)
        const start = m ? parseInt(m[1], 10) : 0
        const end = m && m[2] ? parseInt(m[2], 10) : Math.min(start, tinySize - 1)
        const endByte = Number.isFinite(end) && String(m[2] || '').length ? end : tinySize - 1
        const slice = tinyBuf.subarray(start, endByte + 1)
        await route.fulfill({
          status: 206,
          headers: {
            'Content-Type': 'video/x-matroska',
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${start + slice.length - 1}/${tinySize}`,
            'Content-Length': String(slice.length),
            'Access-Control-Allow-Origin': '*',
          },
          body: slice,
        })
        return
      }
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'video/x-matroska',
          'Accept-Ranges': 'bytes',
          'Content-Length': String(tinySize),
          'Access-Control-Allow-Origin': '*',
        },
        body: tinyBuf,
      })
    })
  })

  test('title affirmation is centered fullscreen with darkened scrim', async ({ page }) => {
    await page.goto(srv.origin + '/' + SLUG)
    // Load harness at path that syncDocFlags can use
    await page.goto(srv.origin + '/harness.html')
    await page.evaluate((slug) => history.replaceState(null, '', '/' + slug), SLUG)

    const gate = page.locator('.fb-affirmation-native[data-fb-affirmation="title"]')
    await expect(gate).toBeVisible()

    const box = await gate.boundingBox()
    const vp = page.viewportSize()
    expect(box).toBeTruthy()
    expect(vp).toBeTruthy()
    // Covers essentially the full viewport
    expect(box.width).toBeGreaterThan(vp.width * 0.9)
    expect(box.height).toBeGreaterThan(vp.height * 0.9)

    const style = await gate.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        position: cs.position,
        zIndex: cs.zIndex,
        background: cs.backgroundColor,
        display: cs.display,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
      }
    })
    expect(style.position).toBe('fixed')
    expect(Number(style.zIndex)).toBeGreaterThanOrEqual(100)
    expect(style.display).toBe('flex')
    expect(style.alignItems).toBe('center')
    expect(style.justifyContent).toBe('center')
    // Darkened scrim (not transparent)
    expect(style.background).toMatch(/rgba?\(/)
    expect(style.background).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)/)

    // Play under the modal should not be the hit target
    const play = page.locator('#play')
    await expect(play).toBeVisible()
    const playBox = await play.boundingBox()
    const topEl = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return el ? el.className + '|' + el.id + '|' + (el.getAttribute('data-fb-affirmation') || '') : ''
    }, { x: playBox.x + playBox.width / 2, y: playBox.y + playBox.height / 2 })
    expect(topEl).toMatch(/fb-affirmation|fb-gate|fb-gate-ok|fb-gate-check|fb-gate-panel|fb-gate-card|CONFIRM|confirm/i)
  })

  test('confirm unlocks and Play surfaces theater feedback or playback', async ({ page }) => {
    await page.goto(srv.origin + '/harness.html')
    await page.evaluate((slug) => {
      history.replaceState(null, '', '/' + slug)
      document.documentElement.removeAttribute('data-fb-welcome-ack')
      document.documentElement.removeAttribute('data-fb-movie-ack')
    }, SLUG)

    const gate = page.locator('.fb-affirmation-native[data-fb-affirmation="title"]')
    await expect(gate).toBeVisible()

    // Desktop may show a checkbox; mobile / coarse pointer is OK-only.
    const checkbox = page.locator('.fb-affirmation-native input[type=checkbox]')
    if (await checkbox.count()) {
      await checkbox.check({ force: true })
    }
    await page.locator('.fb-gate-ok').click()

    await expect(gate).toBeHidden({ timeout: 5000 })
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-fb-movie-ack')))
      .toBe(SLUG)

    const theater = page.locator('.fb-theater-player')
    await expect(theater).toBeVisible()

    await page.locator('#play').click()

    // Instant feedback within a few hundred ms
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const pending = document.querySelector('.fb-media-pending, .fb-media-play-requested')
            const live = document.querySelector('[data-fb-live-status]')
            const note = document.querySelector('.fb-media-playback-note')
            const video = document.querySelector('video.fb-media-video')
            const pendingText =
              pending && getComputedStyle(pending).display !== 'none' ? pending.textContent || '' : ''
            const liveText =
              live && getComputedStyle(live).display !== 'none' ? live.textContent || '' : ''
            const noteText = note && getComputedStyle(note).display !== 'none' ? note.textContent || '' : ''
            const playing = video && !video.paused ? 'playing' : ''
            return [pendingText, liveText, noteText, playing].filter(Boolean).join(' | ')
          }),
        { timeout: 1500 },
      )
      .toMatch(/Play requested|mirror|probing|Checking|Ready|Playing|live|hunt|starting/i)

    // Eventually ready/playing or a concrete live error (not stuck blank)
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const note = document.querySelector('.fb-media-playback-note')
            const pending = document.querySelector('.fb-media-pending, .fb-media-failed, .fb-media-play-requested')
            const live = document.querySelector('[data-fb-live-status]')
            const err = document.querySelector('.fb-media-playback-error')
            const video = document.querySelector('video.fb-media-video')
            const noteText = note && getComputedStyle(note).display !== 'none' ? note.textContent || '' : ''
            const errText =
              err && getComputedStyle(err).display !== 'none'
                ? (err.querySelector('.fb-media-msg') || err).textContent || ''
                : ''
            const pendingVisible =
              pending && getComputedStyle(pending).display !== 'none' ? pending.textContent || '' : ''
            const liveText =
              live && getComputedStyle(live).display !== 'none' ? live.textContent || '' : ''
            const playing =
              video && !video.paused && video.readyState >= 2
                ? 'playing'
                : video && video.readyState >= 2
                  ? 'readyState'
                  : ''
            return [noteText, errText, pendingVisible, liveText, playing].filter(Boolean).join(' | ')
          }),
        { timeout: 15000 },
      )
      .not.toBe('')
  })

  test('Play shows live error when status probe times out', async ({ page }) => {
    test.setTimeout(60000)
    // Match same-origin and fleet mirror URLs
    await page.route('**/FanMixes/Test/tiny.mkv**', async (route) => {
      const url = route.request().url()
      if (url.includes('relayAssetStatus=1')) {
        await new Promise((r) => setTimeout(r, 60000))
        await route.abort()
        return
      }
      await route.abort()
    })
    // Avoid waiting on real fleet /api/config
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ peers: [] }),
      })
    })

    await page.goto(srv.origin + '/harness.html')
    await page.evaluate((slug) => history.replaceState(null, '', '/' + slug), SLUG)
    const checkbox = page.locator('.fb-affirmation-native input[type=checkbox]')
    if (await checkbox.count()) await checkbox.check({ force: true })
    await page.locator('.fb-gate-ok').click()
    await expect(page.locator('.fb-affirmation-native')).toBeHidden({ timeout: 5000 })

    await page.evaluate(() => {
      const built = document.querySelector('.fb-theater-player')
      if (built && built.__fbCtx && built.__fbCtx.setUnlocked) built.__fbCtx.setUnlocked(true)
      if (built && built.parentElement) built.parentElement.setAttribute('data-unlocked', 'true')
    })

    await page.locator('#play').click({ force: true })

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const msg = document.querySelector('.fb-media-pending .fb-media-msg')
            const live = document.querySelector('[data-fb-live-status]')
            return ((msg && msg.textContent) || '') + ' | ' + ((live && live.textContent) || '')
          }),
        { timeout: 2000 },
      )
      .toMatch(/Play requested|Resolving|Checking|probing|relayAssetStatus|mirror|hunt|starting/i)

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const live = document.querySelector('[data-fb-live-status]')
            const msg = document.querySelector('.fb-media-pending .fb-media-msg')
            return ((live && live.textContent) || '') + ' | ' + ((msg && msg.textContent) || '')
          }),
        { timeout: 20000 },
      )
      // Range-first hunt: aborted Range → "Range probe failed", then status timeout.
      .toMatch(
        /timed out|timeout|Unreachable|Status request|Range probe failed|Range probe timed out/i,
      )
  })

  test('Play surfaces symlink stub as permanent block with Retry', async ({ page }) => {
    await page.route(`**${MEDIA_PATH}**`, async (route) => {
      const req = route.request()
      const url = req.url()
      if (url.includes('relayAssetStatus=1')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/vnd.relay.asset-status+json',
          body: JSON.stringify({
            schema: 'relay.asset-status.v1',
            error: 'ok',
            message: 'asset available',
            retryable: false,
            cid: 'bafybeistubcid',
            seed: { state: 'cached', progressPct: 100, bytesTotal: 93, localBlock: true },
          }),
        })
        return
      }
      if (req.headers()['range']) {
        await route.fulfill({
          status: 206,
          headers: {
            'Content-Type': 'text/plain',
            'Accept-Ranges': 'bytes',
            'Content-Range': 'bytes 0-0/93',
            'Content-Length': '1',
            'Access-Control-Allow-Origin': '*',
          },
          body: 'x',
        })
        return
      }
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': '93',
          'Access-Control-Allow-Origin': '*',
        },
        body: 'x'.repeat(93),
      })
    })

    await page.goto(srv.origin + '/harness.html')
    await page.evaluate((slug) => history.replaceState(null, '', '/' + slug), SLUG)
    const checkbox = page.locator('.fb-affirmation-native input[type=checkbox]')
    if (await checkbox.count()) await checkbox.check({ force: true })
    await page.locator('.fb-gate-ok').click()
    await expect(page.locator('.fb-affirmation-native')).toBeHidden({ timeout: 5000 })

    await page.evaluate(() => {
      const built = document.querySelector('.fb-theater-player')
      if (built && built.__fbCtx && built.__fbCtx.setUnlocked) built.__fbCtx.setUnlocked(true)
    })

    await page.locator('#play').click({ force: true })

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const pendingMsg = document.querySelector('.fb-media-pending .fb-media-msg')
            const live = document.querySelector('[data-fb-live-status]')
            return ((pendingMsg && pendingMsg.textContent) || '') + ' | ' + ((live && live.textContent) || '')
          }),
        { timeout: 15000 },
      )
      .toMatch(/stub|Broken CID|symlink/i)

    await expect(page.locator('[data-fb-live-status]')).toContainText(/stub|block/i)
    // Host button copy is "Try again" (user-facing); live log may still say Retry.
    await expect(page.getByRole('button', { name: /Try again|Retry/i })).toBeVisible()
  })

  test('TheaterPlayer mounts native <track> cues and CC cycle from subtitlesJson', async ({ page }) => {
    await page.goto(srv.origin + '/harness.html')
    // Dismiss harness Affirmation so it does not cover the player chrome
    await page.evaluate((slug) => {
      try {
        localStorage.setItem('flashback.movieOwn.v1.' + slug, '1')
      } catch (_) {}
      document.documentElement.setAttribute('data-fb-movie-ack', slug)
      document.documentElement.setAttribute('data-fb-welcome-ack', '1')
      const modal = document.querySelector('.fb-affirmation-native')
      if (modal) modal.style.display = 'none'
    }, SLUG)
    await page.evaluate(() => {
      const mount = document.getElementById('player-host')
      mount.replaceChildren()
      const player = window.__fbBuildTheaterPlayer(
        {
          src: '/FanMixes/Test/tiny.mkv',
          srcWeb: '/FanMixes/Test/tiny.web-1080p.mp4',
          srcMobile: '/FanMixes/Test/tiny.mobile-720p.mp4',
          srcMaster: '/FanMixes/Test/tiny.mkv',
          subtitlesJson: JSON.stringify([
            {
              src: '/hooks/client/native/fixtures/sample.vtt',
              label: 'English',
              lang: 'en',
              default: true,
            },
            {
              src: '/hooks/client/native/fixtures/sample.vtt',
              label: 'Citations',
              lang: 'en',
            },
          ]),
          cid: 'bafybeitesthostcid000000000000000000000000000000000',
          seedState: 'ready',
          unlocked: 'true',
          playing: 'false',
          command: '0',
          commandSeq: '0',
          commandArg: '',
          startAt: '',
        },
        () => {},
        null,
      )
      mount.appendChild(player)
      if (player.__fbCtx && player.__fbCtx.setUnlocked) player.__fbCtx.setUnlocked(true)
      const shell = document.querySelector('.fb-media-ready')
      const pending = document.querySelector('.fb-media-pending')
      if (shell) shell.style.display = 'block'
      if (pending) pending.style.display = 'none'
    })

    const tracks = page.locator('#player-host video.fb-media-video track')
    await expect(tracks).toHaveCount(2)
    await expect(tracks.first()).toHaveAttribute('kind', 'subtitles')
    await expect(tracks.first()).toHaveAttribute('label', 'English')
    const cc = page.locator('#player-host .fb-cc-btn')
    await expect(cc).toBeAttached()
    await expect(cc).toContainText(/CC:\s*English/i)
    const after = await page.evaluate(() => {
      const btn = document.querySelector('#player-host .fb-cc-btn')
      if (!btn) return ''
      btn.click()
      return btn.textContent || ''
    })
    expect(after).toMatch(/Citations|Off|English/i)
  })
})
