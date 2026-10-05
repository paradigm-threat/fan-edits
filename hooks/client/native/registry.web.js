/**
 * Loads park-native web hosts and registers builders with relay-runtime-web.
 * Include before embed.js hydrate (see hooks/server/get.cs inject).
 */
(function () {
  var scripts = [
    '/hooks/client/native/Affirmation.web.js',
    '/hooks/client/native/TheaterPlayer.web.js',
    '/hooks/client/native/NowShowing.web.js',
  ];
  for (var i = 0; i < scripts.length; i++) {
    var s = document.createElement('script');
    s.src = scripts[i];
    s.async = false;
    s.defer = false;
    document.head.appendChild(s);
  }
})();
