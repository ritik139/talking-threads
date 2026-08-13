/**
 * Talking-Thread — PWA registration + in-menu install button
 * -------------------------------------------------------------
 * 1. Registers the shared service worker (sw.js) so the site becomes
 *    installable and works offline for previously-visited pages.
 * 2. Shows a visible "Install App" button in the header icon menu
 *    (data-pwa-install), instead of relying on the browser's hidden
 *    menu — Android/desktop Chrome get the native install prompt on
 *    tap, iOS Safari (which has no install prompt API) gets a short
 *    instruction toast.
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

  if (isStandalone()) {
    // Already installed and running as an app — nothing to prompt.
  } else if (isIOS()) {
    // iOS/Safari has no beforeinstallprompt API — show the button and
    // give tap instructions for the manual Share -> Add to Home Screen flow.
    showInstallButtons();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButtons();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButtons();
  });

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

    if (isIOS()) {
      if (typeof window.showToast === 'function') {
        window.showToast('To install: tap the Share icon, then "Add to Home Screen".');
      } else {
        alert('To install: tap the Share icon, then "Add to Home Screen".');
      }
    }
  });
})();