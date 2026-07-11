const CACHE_VERSION = 'mawahib-offline-v4';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './loading.html',
  './dashboard.html',
  './profil.html',
  './parent.html',
  './carnet-suivi.html',
  './celebration.html',
  './inactivity.html',
  './auth.js',
  './app-settings.js',
  './platform-theme.js',
  './platform-theme.css',
  './notifications.js',
  './registry.js',
  './logo.webp'
];

function isHttpRequest(request) {
  return request.url.startsWith('http://') || request.url.startsWith('https://');
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

async function cacheStaticAssets() {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(STATIC_ASSETS);
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(cacheStaticAssets());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('mawahib-offline-') && !key.startsWith(CACHE_VERSION))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return (await caches.match('./dashboard.html')) || (await caches.match('./login.html'));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fetched = fetch(request)
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetched;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (!isHttpRequest(request) || request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'PREFETCH_URLS' || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    await Promise.all(data.urls.map(async url => {
      try {
        const request = new Request(url, { credentials: 'same-origin' });
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
      } catch (error) {}
    }));
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || 'dashboard.html';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(target);
  })());
});
