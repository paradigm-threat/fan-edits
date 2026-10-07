/**
 * Loads park-native web hosts and registers builders with relay-runtime-web.
 * Include before embed.js hydrate (see hooks/server/get.cs inject).
 */
(function () {
  // In-browser theater host omitted — ExternalPlay / VLC only (avoids tab crashes).
  var scripts = [
    '/hooks/client/native/telemetry.js',
    '/hooks/client/native/Affirmation.host.js',
    '/hooks/client/native/ExternalPlay.host.js',
    '/hooks/client/native/NowShowing.host.js',
    '/hooks/client/native/Board.host.js',
  ];
  for (var i = 0; i < scripts.length; i++) {
    var s = document.createElement('script');
    s.src = scripts[i];
    s.async = false;
    s.defer = false;
    document.head.appendChild(s);
  }
})();
