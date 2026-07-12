const CACHE_VERSION = 'mawahib-offline-v11-admin-restored';
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
  './surah-autoplay.js',
  './prof-simple.js',
  './prof-simple.css',
  './prof-recitation.html',
  './prof-students.html',
  './prof-homework.html',
  './prof-report.html',
  './admin-simple.js',
  './admin-simple.css',
  './controle-mawahib-7x9k.html',
  './controle-487-eleves.html',
  './controle-487-profs.html',
  './controle-487-classes.html',
  './controle-487-finance.html',
  './controle-487-stats.html',
  './controle-487-messages.html',
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
    return new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مواهب المنان</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui;background:#f8faf9;color:#174b36"><main style="padding:24px;text-align:center"><img src="./logo.webp" alt="" width="72" height="72"><p>تعذر فتح هذه الصفحة الآن.</p><button onclick="location.reload()" style="font:inherit;padding:10px 18px;border:0;border-radius:8px;background:#174b36;color:white">إعادة المحاولة</button></main></body></html>`, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fetched = fetch(request)
    .then(response => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
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
        if (response && (response.ok || response.type === 'opaque')) await cache.put(request, response.clone());
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
