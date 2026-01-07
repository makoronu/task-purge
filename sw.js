/**
 * Service Worker
 */
const CACHE_NAME = 'taskpurge-v1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/js/constants.js',
  '/js/config.js',
  '/js/monday-api.js',
  '/js/speech.js',
  '/js/app.js',
  '/manifest.json'
];

// インストール時にキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Network First戦略（APIはキャッシュしない）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Monday API、chrome-extension はキャッシュ対象外
  if (url.hostname === 'api.monday.com' || url.protocol === 'chrome-extension:') {
    event.respondWith(fetch(event.request));
    return;
  }

  // その他はNetwork First
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // レスポンスをキャッシュに保存
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // オフライン時はキャッシュから返す
        return caches.match(event.request);
      })
  );
});
