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
      '<script data-fb-park-native="1" src="/hooks/client/native/Affirmation.web.js"></script>' +
      '<script data-fb-park-native="1" src="/hooks/client/native/TheaterPlayer.web.js"></script>' +
      '<script data-fb-park-native="1" src="/hooks/client/native/NowShowing.web.js"></script>';
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

// CleverScript SSR strips <script> from client JSX; inject after SSR so the browser
// can persist ?ownershipAck=1 / ?movieOwnAck=<slug> without relying on hydrate onClick.
//
// CRITICAL: do NOT remove .fb-gate / .fb-movie-ack nodes (soft-hydrate desync).
// Hide via html[data-fb-*] CSS instead. Persist LS on pointerdown/submit (before
// remount clears the checkbox), set data attrs, then location.replace to strip query.
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
      '<script data-fb-own-inject="1">(function(){try{var WKEY="flashback.ownershipAck.v1";var MPREF="flashback.movieOwn.v1.";var g=globalThis;var s=(location&&location.search)||"";var path=(location&&location.pathname)||"/";function param(name){var k=name+"=";var i=s.indexOf(k);if(i<0){return"";}var r=s.slice(i+k.length);var a=r.indexOf("&");if(a>=0){r=r.slice(0,a);}return r;}function pathSlug(){if(!path||path==="/"){return"";}var p=path.charAt(0)==="/"?path.slice(1):path;var slash=p.indexOf("/");if(slash>=0){p=p.slice(0,slash);}return p;}function ensureCss(){try{if(!document.getElementById("fb-own-unlock-css")){var st=document.createElement("style");st.id="fb-own-unlock-css";st.textContent=".fb-media-unlock-target{display:none}.fb-video-controls .fb-btn{opacity:.45;pointer-events:none}html[data-fb-welcome-ack=\\"1\\"] .fb-gate{display:none!important}html[data-fb-welcome-ack=\\"1\\"][data-fb-movie-ack] .fb-media-locked{display:none!important}html[data-fb-welcome-ack=\\"1\\"][data-fb-movie-ack] .fb-media-unlock-target{display:block!important}html[data-fb-welcome-ack=\\"1\\"][data-fb-movie-ack] .fb-movie-ack{display:none!important}html[data-fb-welcome-ack=\\"1\\"][data-fb-movie-ack] .fb-video-controls .fb-btn{opacity:1;pointer-events:auto}";(document.head||document.documentElement).appendChild(st);}}catch(eCss){}}g.__fbHasWelcome=function(){try{if(localStorage&&localStorage.getItem){return localStorage.getItem(WKEY)==="1";}}catch(eW){}return false;};g.__fbHasMovieOwn=function(slug){try{if(slug&&localStorage&&localStorage.getItem){return localStorage.getItem(MPREF+slug)==="1";}}catch(eM){}return false;};function syncDocFlags(){try{var el=document.documentElement;var ps=pathSlug();var ok=false;if(g.__fbHasWelcome()){el.setAttribute("data-fb-welcome-ack","1");}else{el.removeAttribute("data-fb-welcome-ack");}if(ps&&g.__fbHasMovieOwn(ps)){el.setAttribute("data-fb-movie-ack",ps);ok=true;}else{el.removeAttribute("data-fb-movie-ack");}if(g.__fbHasWelcome()&&ok===true){el.classList.add("fb-playback-unlocked");try{var btns=document.querySelectorAll(".fb-video-controls button");for(var bi=0;bi<btns.length;bi++){btns[bi].disabled=false;}}catch(eB){}}else{el.classList.remove("fb-playback-unlocked");}}catch(eF){}}function writeWelcome(){try{if(localStorage&&localStorage.setItem){localStorage.setItem(WKEY,"1");}}catch(e1){}try{document.documentElement.setAttribute("data-fb-welcome-ack","1");}catch(e2){}syncDocFlags();}function writeMovie(slug){if(!slug||slug.length===0){return;}try{if(localStorage&&localStorage.setItem){localStorage.setItem(MPREF+slug,"1");}}catch(e3){}try{document.documentElement.setAttribute("data-fb-movie-ack",slug);}catch(e4){}syncDocFlags();}function formHasCheckedConfirm(form){try{if(!form||!form.querySelector){return false;}var cb=form.querySelector("input[type=checkbox][name=confirm]");if(cb&&cb.checked){return true;}}catch(e5){}return false;}function walkHasClass(node, cls){var n=node;while(n&&n!==document){try{if(n.classList&&n.classList.contains(cls)){return n;}}catch(e6){}n=n.parentNode;}return null;}function onConfirmPointer(ev){try{var t=ev&&ev.target;if(!t){return;}var gateBtn=walkHasClass(t,"fb-gate-ok");if(gateBtn){var gf=gateBtn.form||walkHasClass(gateBtn,"fb-gate-form");if(formHasCheckedConfirm(gf)===true){writeWelcome();}return;}var movieBtn=walkHasClass(t,"fb-movie-ack-ok");if(movieBtn){var mf=movieBtn.form||walkHasClass(movieBtn,"fb-movie-ack-form");if(formHasCheckedConfirm(mf)===true){var slug="";try{var hid=mf.querySelector("input[type=hidden][name=movieOwnAck]");if(hid&&hid.value){slug=""+hid.value;}}catch(e7){}if(slug.length===0){slug=pathSlug();}writeMovie(slug);try{var own=mf.querySelector("input[type=hidden][name=ownershipAck]");if(own&&own.value==="1"){writeWelcome();}}catch(e8){}}}}catch(eP){}}function onConfirmSubmit(ev){try{var form=ev&&ev.target;if(!form||!form.classList){return;}if(form.classList.contains("fb-gate-form")===true){if(formHasCheckedConfirm(form)===true){writeWelcome();}return;}if(form.classList.contains("fb-movie-ack-form")===true){if(formHasCheckedConfirm(form)===true){var slug="";try{var hid=form.querySelector("input[type=hidden][name=movieOwnAck]");if(hid&&hid.value){slug=""+hid.value;}}catch(e9){}if(slug.length===0){slug=pathSlug();}writeMovie(slug);try{var own=form.querySelector("input[type=hidden][name=ownershipAck]");if(own&&own.value==="1"){writeWelcome();}}catch(e10){}}}}catch(eS0){}}ensureCss();try{if(document&&document.addEventListener){document.addEventListener("pointerdown",onConfirmPointer,true);document.addEventListener("click",onConfirmPointer,true);document.addEventListener("submit",onConfirmSubmit,true);}}catch(eBind){}var dirty=false;if(s.indexOf("ownershipAck=1")>=0){writeWelcome();dirty=true;}var slug=param("movieOwnAck");if(slug&&slug.length>0){try{if(typeof decodeURIComponent==="function"){slug=decodeURIComponent(slug);}}catch(e0){}writeMovie(slug);dirty=true;}syncDocFlags();if(dirty===true){try{location.replace(path);}catch(eR){if(history&&history.replaceState){history.replaceState(null,"",path);}syncDocFlags();}}else{syncDocFlags();}try{if(typeof setTimeout==="function"){setTimeout(function(){try{document.documentElement.setAttribute("data-fb-client-ready","1");syncDocFlags();}catch(eT){}},150);}}catch(eS){}}catch(e){}})();</script>';

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
      return injectOwnershipGateScript(injectParkNativeHosts(ssr));
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
