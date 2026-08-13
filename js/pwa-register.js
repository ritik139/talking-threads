/**
 * Talking-Thread — PWA registration
 * ----------------------------------
 * Registers the shared service worker (sw.js) so the site becomes installable
 * ("Add to Home Screen" / desktop install icon) and works offline for
 * previously-visited pages. Safe to load alongside the existing notification
 * logic in sw.js — registration is idempotent.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silently ignore — the site still works fully without the service worker.
    });
  });
}