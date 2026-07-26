importScripts('./offline-lessons.js');

const CACHE_VERSION = 'mawahib-offline-v35-virtual-teacher-20260726';
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
  './offline-bootstrap.js',
  './offline-lessons.js',
  './manifest.webmanifest',
  './pwa-icons/icon-192.png',
  './pwa-icons/icon-512.png',
  './pwa-icons/icon-maskable-512.png',
  './first-use-guide.js',
  './platform-theme.js',
  './platform-theme.css',
  './juz-puzzle.js',
  './juz-puzzle.css',
  './juz-recitation-teacher.js',
  './juz-recitation-teacher.css',
  './notifications.js',
  './surah-autoplay.js',
  './prof-simple.js',
  './prof-simple.css',
  './admin-simple.css',
  './admin-simple.js',
  './dashboard_prof.html',
  './prof-recitation.html',
  './prof-students.html',
  './prof-analytics.html',
  './prof-homework.html',
  './controle-487-activity.html',
  './prof-report.html',
  './controle-mawahib-7x9k.html',
  './controle-487-stats.html',
  './controle-487-profs.html',
  './controle-487-messages.html',
  './controle-487-finance.html',
  './controle-487-eleves.html',
  './controle-487-classes.html',
  './admin.html',
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
  await Promise.all(STATIC_ASSETS.map(async asset => {
    const request = new Request(asset, { cache: 'reload', credentials: 'same-origin' });
    const response = await fetch(new Request(request, { cache: 'no-store' }));
    if (!response.ok) throw new Error(`Unable to cache ${asset}: ${response.status}`);
    await cache.put(asset, response);
  }));
}

let lessonLibraryPromise = null;
async function cacheLessonLibrary() {
  if (lessonLibraryPromise) return lessonLibraryPromise;
  lessonLibraryPromise = (async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const lessons = Array.isArray(self.MAWAHIB_OFFLINE_LESSONS) ? self.MAWAHIB_OFFLINE_LESSONS : [];
    let cached = 0;
    for (let index = 0; index < lessons.length; index += 4) {
      const batch = lessons.slice(index, index + 4);
      await Promise.all(batch.map(async asset => {
        try {
          const existing = await cache.match(asset, { ignoreSearch: true });
          if (existing) { cached += 1; return; }
          const request = new Request(asset, { cache: 'no-store', credentials: 'same-origin' });
          const response = await fetch(request);
          if (response.ok) { await cache.put(request, response.clone()); cached += 1; }
        } catch (_) {}
      }));
    }
    const result = { type: 'OFFLINE_LIBRARY_READY', cached, total: lessons.length };
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach(client => client.postMessage(result));
    return result;
  })().finally(() => { lessonLibraryPromise = null; });
  return lessonLibraryPromise;
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
    const response = await fetch(new Request(request, { cache: 'no-store' }));
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مواهب المنان</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui;background:#f8faf9;color:#174b36"><main style="padding:24px;text-align:center"><img src="./logo.webp" alt="" width="72" height="72"><p>تعذر فتح هذه الصفحة الآن.</p><button onclick="location.reload()" style="font:inherit;padding:10px 18px;border:0;border-radius:8px;background:#174b36;color:white">إعادة المحاولة</button></main></body></html>`, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await caches.match(request, { ignoreSearch: true });
  const fetched = fetch(request)
    .then(response => {
      if (response && (response.status === 200 || response.type === 'opaque')) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => cached);
  return cached || fetched;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (!isHttpRequest(request) || request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.hostname.endsWith('.supabase.co')) return;
  if (!isSameOrigin(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || /\.(?:js|css|json)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'PREFETCH_LESSON_LIBRARY') { event.waitUntil(cacheLessonLibrary()); return; }
  if (data.type !== 'PREFETCH_URLS' || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    await Promise.all(data.urls.map(async url => {
      try {
        const request = new Request(url, { credentials: 'same-origin', cache: 'reload' });
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
