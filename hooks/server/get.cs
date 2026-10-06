import { fetchIpfsBytesFromGetContext, resolveIpfsFromGetContext } from '@relay/ipfs';
import { optimizeRasterFromGetContext, queryWidth } from '@relay/image';
import { ssrClientHookFromGetContext } from '@relay/ssr';
// Opt into framework /assets + /wasm (embed.js hydrate). Scanned statically by the gateway.
import { pinnedPrefix, wasmPrefix } from '@relay/web-assets';

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

// Park-native *.host.js scripts are injected by relay-gateway (before embed.js) when the
// SSR tree contains data-relay-park-native placeholders — see inject_park_native_host_scripts.

export default function run(ctx, next) {
  // Keep the import live for CleverScript / static scanners.
  try {
    if (typeof pinnedPrefix === 'function') {
      pinnedPrefix();
    }
  } catch (e) {}
  try {
    if (typeof wasmPrefix === 'function') {
      wasmPrefix();
    }
  } catch (e) {}

  if (wantsSiteShell(ctx)) {
    var ssr = ssrClientHookFromGetContext(ctx, {
      clientHookPath: "hooks/client/get.jsx"
    });
    if (ssr !== null) {
      return ssr;
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

  // Thin IPFS: logical media paths are absent from Git; serve via central .ipfs stubs.
  var ipfsFile = resolveIpfsFromGetContext(ctx, {
    sources: ["centralDir", "manifest"]
  });
  if (ipfsFile !== null) {
    return ipfsFile;
  }

  return next(ctx);
}
