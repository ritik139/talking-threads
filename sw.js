/**
 * Talking-Thread — notification service worker
 * ---------------------------------------------
 * This worker exists for ONE reason: mobile Chrome/Firefox (Android) refuse to run
 * `new Notification(...)` from a plain page script — calling it throws
 * "Failed to construct 'Notification': Illegal constructor. Use
 * ServiceWorkerRegistration.showNotification() instead." A service worker is required
 * before `registration.showNotification()` can be used, so this file registers one.
 *
 * It intentionally does NOT intercept fetches or cache anything — the site's normal
 * networking behaviour is untouched. It only supports notification display and lets a
 * tap on a notification focus (or open) the admin dashboard.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Safety net: this worker never creates a Cache Storage entry itself, but
    // clear out any caches left behind by a previous worker version (or a
    // future change) so stale assets can never be served from here.
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
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