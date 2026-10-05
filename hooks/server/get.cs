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
// can persist ?ownershipAck=1 and hide the gate without relying on hydrate handlers.
function injectOwnershipGateScript(ssr) {
  try {
    if (ssr === null) {
      return null;
    }
    var html = ssr.bodyUtf8;
    if (typeof html !== 'string') {
      return ssr;
    }
    if (html.indexOf('flashback.ownershipAck.v1') >= 0) {
      return ssr;
    }
    var snip =
      '<script>(function(){try{var KEY="flashback.ownershipAck.v1";var s=(location&&location.search)||"";var ack=false;if(s.indexOf("ownershipAck=1")>=0){ack=true;}else if(localStorage&&localStorage.getItem&&localStorage.getItem(KEY)==="1"){ack=true;}if(ack!==true){return;}if(localStorage&&localStorage.setItem){localStorage.setItem(KEY,"1");}var g=document.querySelector(".fb-gate");if(g){if(g.remove){g.remove();}else if(g.parentNode){g.parentNode.removeChild(g);}}if(s.indexOf("ownershipAck=1")>=0&&history&&history.replaceState){history.replaceState(null,"",(location&&location.pathname)||"/");}}catch(e){}})();</script>';
    var needle = '<script type="application/json" id="relay-embed-config">';
    if (html.indexOf(needle) < 0) {
      return ssr;
    }
    var parts = html.split(needle);
    if (!parts || parts.length < 2) {
      return ssr;
    }
    var out = parts[0] + snip + needle + parts[1];
    // If split produced more than 2 parts, rejoin the rest.
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
