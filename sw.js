/* Simmons Civil Inspections — service worker (offline shell + auto-update)
   Bump SW_VERSION on every deploy to push an update to installed devices. */
const SW_VERSION = 'scc-v1.0.11';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './assets/simmons-logo.png',
  './assets/icon-192.png', './assets/icon-512.png',
  './assets/icon-maskable-512.png', './assets/apple-touch-icon.png'
];
const CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/docx@9.0.2/build/index.umd.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SW_VERSION).then((c) => Promise.all(
    [...CORE, ...CDN].map((u) => c.add(u).catch(() => {}))
  )));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url; try { url = new URL(req.url); } catch (_) { return; }

  // Supabase API / Storage: always live network (auth + uploads must not be cached).
  if (/\.supabase\.co$/.test(url.hostname)) return;

  // CDN libraries: cache-first (so the app + docx engine work fully offline).
  if (url.origin !== self.location.origin) {
    e.respondWith(caches.match(req).then((c) => c || fetch(req).then((r) => {
      const cp = r.clone(); caches.open(SW_VERSION).then((ca) => ca.put(req, cp)); return r;
    }).catch(() => c)));
    return;
  }

  // Same-origin app files: stale-while-revalidate.
  e.respondWith(caches.match(req).then((cached) => {
    const net = fetch(req).then((r) => {
      const cp = r.clone(); caches.open(SW_VERSION).then((ca) => ca.put(req, cp)); return r;
    }).catch(() => cached);
    return cached || net;
  }));
});
