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
    if (html.indexOf('data-fb-park-native="1"') >= 0) {
      return ssr;
    }
    var snip =
      '<script data-fb-park-native="1" src="/hooks/client/native/Affirmation.host.js"></script>' +
      '<script data-fb-park-native="1" src="/hooks/client/native/TheaterPlayer.host.js"></script>' +
      '<script data-fb-park-native="1" src="/hooks/client/native/NowShowing.host.js"></script>';
    var needle = '<script type="module" src="';
    var emb = html.indexOf('/assets/');
    var embJs = html.indexOf('embed.js');
    if (embJs < 0) {
      needle = '<script type="application/json" id="relay-embed-config">';
      if (html.indexOf(needle) < 0) {
        return ssr;
      }
      var parts = html.split(needle);
      if (!parts || parts.length < 2) {
        return ssr;
      }
      var out = parts[0] + snip + needle + parts[1];
      var file = {};
      file.kind = 'file';
      file.contentType = 'text/html; charset=utf-8';
      file.bodyUtf8 = out;
      try {
        if (ssr.headers) {
          file.headers = ssr.headers;
        }
      } catch (e2) {}
      return file;
    }
    var idx = html.lastIndexOf('<script', embJs);
    if (idx < 0) {
      return ssr;
    }
    var out2 = html.slice(0, idx) + snip + html.slice(idx);
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
