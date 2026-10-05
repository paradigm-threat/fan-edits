/**
 * Unit check: park-host injection must land before </body>, not after </html>.
 * Run: node hooks/client/native/inject-park-hosts.test.mjs
 */
import assert from 'node:assert/strict'
// Mirrors relay-gateway `inject_park_native_host_scripts` (embed_html.rs).
function injectParkNativeHosts(html) {
  var bodyClose = html.lastIndexOf('</body>')
  var firstHost = html.indexOf('data-fb-park-native="1"')
  var hostsOk = firstHost >= 0 && (bodyClose < 0 || firstHost < bodyClose)
  if (hostsOk) return html

  var cleaned = html
  while (true) {
    var bad = cleaned.lastIndexOf('</html>')
    if (bad < 0) break
    var tail = cleaned.slice(bad + 7)
    if (tail.indexOf('data-fb-park-native="1"') < 0) break
    cleaned = cleaned.slice(0, bad + 7)
  }
  var hostMarker = '<script data-fb-park-native="1"'
  while (cleaned.indexOf(hostMarker) >= 0) {
    var hi = cleaned.indexOf(hostMarker)
    var he = cleaned.indexOf('</script>', hi)
    if (he < 0) break
    cleaned = cleaned.slice(0, hi) + cleaned.slice(he + 9)
  }
  html = cleaned
  var snip =
    '<script data-fb-park-native="1" src="/hooks/client/native/park-host-common.js"></script>' +
    '<script data-fb-park-native="1" src="/hooks/client/native/Affirmation.host.js"></script>'
  bodyClose = html.lastIndexOf('</body>')
  var embedIdx = html.lastIndexOf('<script type="module"')
  var insertAt = -1
  if (embedIdx >= 0 && (bodyClose < 0 || embedIdx < bodyClose)) insertAt = embedIdx
  else if (bodyClose >= 0) insertAt = bodyClose
  else insertAt = html.lastIndexOf('</html>')
  return html.slice(0, insertAt) + snip + html.slice(insertAt)
}

const sample =
  '<html><body><div id="root"></div>' +
  '<script type="application/json" id="relay-embed-config">{}</script>' +
  '<script type="module" src="/assets/c/abc/embed.js"></script></body></html>' +
  '<script data-fb-park-native="1" src="/hooks/client/native/Affirmation.host.js"></script>'

const out = injectParkNativeHosts(sample)
const bodyClose = out.lastIndexOf('</body>')
const firstHost = out.indexOf('data-fb-park-native="1"')
assert.ok(firstHost >= 0 && firstHost < bodyClose, 'hosts must be inside body')
assert.ok(out.indexOf('park-host-common.js') >= 0, 'common boot script included')
assert.ok(!out.includes('</html><script data-fb-park-native'), 'no hosts after html')

assert.match(getCs, /park-host-common\.js/, 'get.cs references common boot script')

console.log('inject-park-hosts.test.mjs OK')
