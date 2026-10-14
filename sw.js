/* QRGen service worker — offline-first
   - App shell (halaman + aset lokal) : cache-first
   - APK di /download/ : network-only (apakah file besar; offline tidak butuh)
*/
var CACHE = 'qrgen-v1.3.0';
var SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/poppins.css', './css/style.css',
  './js/app.js', './vendor/qrcode-generator.js', './vendor/jsQR.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', handler);

function handler(e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;          // CDN lain: jangan ganggu
  if (url.pathname.indexOf('/download/') === 0) return; // APK: jangan cache
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        // fallback navigasi offline
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
}
