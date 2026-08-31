const VERSION = "mawahib-v3-20260831-notifications-2";
const STATIC_CACHE = `${VERSION}-static`;
const QURAN_CACHE = `${VERSION}-quran`;
const AUDIO_CACHE = `${VERSION}-audio`;
const STATIC = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("message", (event) => { if (event.data?.type === "SKIP_WAITING") void self.skipWaiting(); });
self.addEventListener("push", (event) => {
  let payload = { title: "e-Mawahib", body: "لديك إشعار جديد.", href: "/", tag: "mawahib-notification" };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch { if (event.data) payload.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, tag: payload.tag, data: { href: payload.href }, dir: "rtl", lang: "ar" }));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/_next/static/")) event.respondWith(cacheFirst(request, STATIC_CACHE));
  else if (url.pathname.includes("/student/quran") || url.pathname.includes("/api/quran")) event.respondWith(networkFirst(request, QURAN_CACHE));
  else if (request.destination === "audio" || /\.mp3($|\?)/i.test(url.href)) event.respondWith(boundedCacheFirst(request, AUDIO_CACHE, 24));
});
self.addEventListener("notificationclick", (event) => { event.notification.close(); const href = event.notification.data?.href || "/"; event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => { const existing = clients.find((client) => "focus" in client); return existing ? existing.navigate(href).then(() => existing.focus()) : self.clients.openWindow(href); })); });

async function cacheFirst(request, name) { const cache = await caches.open(name); return (await cache.match(request)) || fetchAndCache(request, cache); }
async function networkFirst(request, name) { const cache = await caches.open(name); try { return await fetchAndCache(request, cache); } catch { return (await cache.match(request)) || Response.error(); } }
async function fetchAndCache(request, cache) { const response = await fetch(request); if (response.ok && response.type !== "opaque") await cache.put(request, response.clone()); return response; }
async function boundedCacheFirst(request, name, maxEntries) { const cache = await caches.open(name); const hit = await cache.match(request); if (hit) return hit; const response = await fetch(request); if (response.ok) { await cache.put(request, response.clone()); const keys = await cache.keys(); while (keys.length > maxEntries) await cache.delete(keys.shift()); } return response; }
