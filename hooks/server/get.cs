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

// CleverScript SSR strips <script> from client JSX; inject after SSR so the browser
// can persist ?ownershipAck=1 / ?movieOwnAck=<slug> without relying on hydrate onClick.
//
// CRITICAL: do NOT hide/remove .fb-gate / .fb-movie-ack here. Mutating those nodes
// before soft-hydrate desyncs vnode↔DOM and freezes updates — leaving the locked
// player message with no form. Persist LS, then location.replace to a clean URL so
// React can unlock from localStorage once isClientLive().
function injectOwnershipGateScript(ssr) {
  try {
    if (ssr === null) {
      return null;
    }
    var html = ssr.bodyUtf8;
    if (typeof html !== 'string') {
      return ssr;
    }
    // Unique marker — do not key off flashback.movieOwn.v1. (may appear elsewhere).
    if (html.indexOf('data-fb-own-inject="1"') >= 0) {
      return ssr;
    }
    var snip =
      '<script data-fb-own-inject="1">(function(){try{var WKEY="flashback.ownershipAck.v1";var MPREF="flashback.movieOwn.v1.";var s=(location&&location.search)||"";var path=(location&&location.pathname)||"/";function param(name){var k=name+"=";var i=s.indexOf(k);if(i<0){return"";}var r=s.slice(i+k.length);var a=r.indexOf("&");if(a>=0){r=r.slice(0,a);}return r;}var dirty=false;if(s.indexOf("ownershipAck=1")>=0){if(localStorage&&localStorage.setItem){localStorage.setItem(WKEY,"1");}dirty=true;}var slug=param("movieOwnAck");if(slug&&slug.length>0){try{if(typeof decodeURIComponent==="function"){slug=decodeURIComponent(slug);}}catch(e0){}if(localStorage&&localStorage.setItem){localStorage.setItem(MPREF+slug,"1");}dirty=true;}if(dirty===true){try{location.replace(path);}catch(eR){if(history&&history.replaceState){history.replaceState(null,"",path);}}}}catch(e){}})();</script>';
    var needle = '<script type="application/json" id="relay-embed-config">';
    if (html.indexOf(needle) < 0) {
      return ssr;
    }
    var parts = html.split(needle);
    if (!parts || parts.length < 2) {
      return ssr;
    }
    var out = parts[0] + snip + needle + parts[1];
    if (parts.length > 2) {
      var rest = '';
      for (var i = 2; i < parts.length; i++) {
        rest = rest + needle + parts[i];
      }
      out = out + rest;
    }
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
  } catch (e) {
    return ssr;
  }
}

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
      return injectOwnershipGateScript(ssr);
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
