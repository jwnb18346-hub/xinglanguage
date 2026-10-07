const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const CACHE_NAME = `xingo-v62-${BASE_PATH || 'root'}`;
const APP_SHELL = ['/', '/manifest.json', '/xingo-mark.svg', '/xingo-logo.svg', '/icon-192.png', '/icon-512.png', '/icon-maskable-192.png', '/icon-maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map((path) => BASE_PATH + path))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('xingo-') && key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (BASE_PATH && !url.pathname.startsWith(BASE_PATH + '/')) return;
  const pathname = url.pathname.slice(BASE_PATH.length);

  // Monitoring must always observe the live deployment rather than an offline cache.
  if (pathname === '/health.json') return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(BASE_PATH + '/', copy));
      return response;
    }).catch(() => caches.match(BASE_PATH + '/')));
    return;
  }

  if (pathname.startsWith('/audio/')) {
    // Let the browser handle byte-range requests and its immutable HTTP cache.
    // Intercepting media here forces a full download before playback can begin.
    return;
  }

  if (pathname.startsWith('/assets/') || pathname.startsWith('/books/text/') || /\.(?:png|svg|json)$/.test(pathname)) {
    event.respondWith(caches.match(request).then(async (cached) => {
      if (cached && !cached.headers.get('content-type')?.includes('text/html')) return cached;
      if (cached) await caches.delete(request);
      const response = await fetch(request);
      if (response.ok && !response.headers.get('content-type')?.includes('text/html')) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }));
  }
});
