/**
 * Talking-Thread — service worker
 * ---------------------------------------------
 * Two jobs:
 * 1. Notifications: mobile Chrome/Firefox (Android) refuse to run
 *    `new Notification(...)` from a plain page script — calling it throws
 *    "Failed to construct 'Notification': Illegal constructor. Use
 *    ServiceWorkerRegistration.showNotification() instead." A service worker is
 *    required before `registration.showNotification()` can be used.
 * 2. PWA installability + basic offline support: caches the app shell (static
 *    pages, CSS, JS, icons) so the site can be "Added to Home Screen" and still
 *    load previously-visited pages when offline. API calls (/api/*) and any
 *    non-GET request are always passed straight to the network — never cached —
 *    so cart/orders/auth data stays live and correct.
 */

const CACHE_NAME = 'tt-shell-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/favicon-64.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // don't block install if a shell asset 404s
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Drop any caches from a previous worker version before claiming clients.
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever handle simple GET navigations/assets. Everything else (API
  // calls, POST/PUT/DELETE, cross-origin requests) goes straight to the network.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes('admin-dashboard.html'));
      if (existing) return existing.focus();
      return self.clients.openWindow('/admin-dashboard.html');
    })
  );
});