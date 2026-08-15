/**
 * Talking-Thread — PWA registration + in-menu install button
 * -------------------------------------------------------------
 * 1. Registers the shared service worker (sw.js) so the site becomes
 *    installable and works offline for previously-visited pages.
 * 2. Shows a visible "Install App" button in the header icon menu
 *    (data-pwa-install) — but ONLY on mobile devices (per product
 *    requirement; desktop never shows this button).
 *
 * Why the button used to appear inconsistently:
 * Chrome only fires `beforeinstallprompt` when its own internal
 * "engagement heuristics" are satisfied (varies by visit count, time
 * spent, prior dismissals, etc.) — it is NOT guaranteed on every visit,
 * and iOS Safari never fires it at all. Gating button visibility on
 * that event is what caused it to show "sometimes, sometimes not".
 *
 * Fix: on mobile, show the button unconditionally (as soon as we know
 * the device is a phone/tablet and the app isn't already installed),
 * independent of whether the browser ever fires beforeinstallprompt.
 * On tap:
 *   - if Chrome DID capture a deferred prompt -> use the real native
 *     install dialog (best case).
 *   - else if iOS -> show the manual Share -> Add to Home Screen steps.
 *   - else (Android/other mobile browser that hasn't fired the event
 *     yet) -> show manual "browser menu -> Install app" steps, so the
 *     button always does something useful instead of silently failing.
 */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  // Broad mobile-device check (UA based, not viewport-width based) so
  // resizing a desktop browser window never triggers it, and a real
  // phone/tablet always does — this is a MOBILE-ONLY feature by design.
  const isMobileDevice = () =>
    /android|iphone|ipad|ipod|windows phone|mobile/i.test(navigator.userAgent);

  let deferredPrompt = null;

  function showInstallButtons() {
    document.querySelectorAll('[data-pwa-install]').forEach((btn) => {
      btn.style.display = '';
    });
  }

  function hideInstallButtons() {
    document.querySelectorAll('[data-pwa-install]').forEach((btn) => {
      btn.style.display = 'none';
    });
  }

  function initInstallButtonVisibility() {
    if (isStandalone()) {
      // Already installed and running as an app — nothing to prompt.
      hideInstallButtons();
      return;
    }
    if (isMobileDevice()) {
      // Show right away on mobile — don't wait for (and don't require)
      // beforeinstallprompt, since Chrome won't reliably fire it.
      showInstallButtons();
    } else {
      // Desktop: keep hidden unless/until Chrome fires a real prompt.
      hideInstallButtons();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInstallButtonVisibility);
  } else {
    initInstallButtonVisibility();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone()) showInstallButtons();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButtons();
  });

  function showManualInstructions() {
    const msg = isIOS()
      ? 'To install: tap the Share icon, then "Add to Home Screen".'
      : 'To install: open your browser menu (⋮) and tap "Install app" or "Add to Home screen".';
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      alert(msg);
    }
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-pwa-install]');
    if (!btn) return;

    if (deferredPrompt) {
      btn.disabled = true;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (err) {}
      deferredPrompt = null;
      btn.disabled = false;
      hideInstallButtons();
      return;
    }

    // No native prompt captured (common on Android when Chrome hasn't
    // met its own engagement bar yet, and always on iOS) — fall back
    // to manual instructions instead of the button doing nothing.
    showManualInstructions();
  });
})();