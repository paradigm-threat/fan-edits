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

export default function run(ctx, next) {
  if (wantsSiteShell(ctx)) {
    var ssr = ssrClientHookFromGetContext(ctx, {
      clientHookPath: "hooks/client/get.jsx"
    });
    if (ssr !== null) { return ssr; }
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
