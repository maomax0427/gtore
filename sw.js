// アプリ本体をキャッシュして、電車の中など電波が弱くても勉強できるようにする。
const CACHE = 'gtore-v2';
const NN = Array.from({ length: 11 }, (_, i) => String(i + 1).padStart(2, '0'));
const DATA = ['chapters', ...NN.map(n => 'ch' + n), ...NN.map(n => 'more' + n)].map(n => `data/${n}.js`);
const SHELL = ['./', 'index.html', 'style.css', 'app.js', ...DATA, 'manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// ネット優先（問題の追加がすぐ反映される）、つながらなければキャッシュ
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
