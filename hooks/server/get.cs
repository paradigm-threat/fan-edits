import { fetchIpfsBytesFromGetContext, resolveIpfsFromGetContext } from '@relay/ipfs';
import { optimizeRasterFromGetContext, queryWidth } from '@relay/image';
import { ssrClientHookFromGetContext } from '@relay/ssr';
// Opt into framework /assets + /wasm (embed.js hydrate). Scanned statically by the gateway.
import { pinnedPrefix } from '@relay/web-assets';

// Parked site shell + thin IPFS media for Flashback Repository.
function wantsSiteShell(ctx) {
  try {
    if (ctx.embedMarkdownRequest === true) return true;
  } catch (e) {}
  try {
    if (ctx.siteShellRequest === true) return true;
  } catch (e) {}
  return false;
}

// CleverScript SSR strips <script> from client JSX; inject park-native host scripts
// (Affirmation / TheaterPlayer / NowShowing) before embed.js so builders register.
function injectParkNativeHosts(ssr) {
  try {
    if (ssr === null) {
      return null;
    }
    var html = ssr.bodyUtf8;
    if (typeof html !== 'string') {
      return ssr;
    }
    // Re-inject if hosts were appended after </html> (invalid; browsers skip them).
    var bodyClose = html.lastIndexOf('</body>');
    var firstHost = html.indexOf('data-fb-park-native="1"');
    var hostsOk =
      firstHost >= 0 && (bodyClose < 0 || (firstHost >= 0 && firstHost < bodyClose));
    if (hostsOk) {
      return ssr;
    }
    // Strip broken trailing injections from older tips.
    var cleaned = html;
    while (true) {
      var bad = cleaned.lastIndexOf('</html>');
      if (bad < 0) {
        break;
      }
      var tail = cleaned.slice(bad + 7);
      if (tail.indexOf('data-fb-park-native="1"') < 0) {
        break;
      }
      cleaned = cleaned.slice(0, bad + 7);
    }
    var hostMarker = '<script data-fb-park-native="1"';
    while (cleaned.indexOf(hostMarker) >= 0) {
      var hi = cleaned.indexOf(hostMarker);
      var he = cleaned.indexOf('</script>', hi);
      if (he < 0) {
        break;
      }
      cleaned = cleaned.slice(0, hi) + cleaned.slice(he + 9);
    }
    html = cleaned;
    var snip =
      '<script data-fb-park-native="1" src="/hooks/client/native/park-host-common.js"></script>' +
      '<script data-fb-park-native="1" src="/hooks/client/native/Affirmation.host.js"></script>' +
      '<script data-fb-park-native="1" src="/hooks/client/native/TheaterPlayer.host.js"></script>' +
      '<script data-fb-park-native="1" src="/hooks/client/native/NowShowing.host.js"></script>';
    bodyClose = html.lastIndexOf('</body>');
    var embedIdx = html.lastIndexOf('<script type="module"');
    var insertAt = -1;
    if (embedIdx >= 0 && (bodyClose < 0 || embedIdx < bodyClose)) {
      insertAt = embedIdx;
    } else if (bodyClose >= 0) {
      insertAt = bodyClose;
    } else {
      var htmlClose = html.lastIndexOf('</html>');
      insertAt = htmlClose >= 0 ? htmlClose : html.length;
    }
    if (insertAt < 0) {
      return ssr;
    }
    var out2 = html.slice(0, insertAt) + snip + html.slice(insertAt);
    var file2 = {};
    file2.kind = 'file';
    file2.contentType = 'text/html; charset=utf-8';
    file2.bodyUtf8 = out2;
    try {
      if (ssr.headers) {
        file2.headers = ssr.headers;
      }
    } catch (e3) {}
    return file2;
  } catch (e) {
    return ssr;
  }
}

// Ownership persistence / unlock CSS lives in Affirmation.host.js (park native).

export default function run(ctx, next) {
  // Keep the import live for CleverScript / static scanners.
  try {
    if (typeof pinnedPrefix === 'function') {
      pinnedPrefix();
    }
  } catch (e) {}

  if (wantsSiteShell(ctx)) {
    var ssr = ssrClientHookFromGetContext(ctx, {
      clientHookPath: "hooks/client/get.jsx"
    });
    if (ssr !== null) {
      return injectParkNativeHosts(ssr);
    }
  }

  var maxW = queryWidth(ctx);
  if (maxW !== null) {
    var bytes = fetchIpfsBytesFromGetContext(ctx, {
      sources: ["centralDir", "manifest"]
    });
    var webp = optimizeRasterFromGetContext(ctx, bytes, { width: maxW });
    if (webp !== null) {
      return webp;
    }
  }

  var ipfsOpts = { sources: ["centralDir", "manifest"] };
  var file = resolveIpfsFromGetContext(ctx, ipfsOpts);
  if (file !== null) {
    return file;
  }
  return next();
}
