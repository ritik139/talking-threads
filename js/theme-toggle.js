/* ==========================================================================
   Talking-Thread — Night Mode / Luxury Mode toggle
   Works with the inline anti-flash script in <head> of every page, which
   already sets [data-theme] on <html> before first paint. This file only
   wires up the toggle buttons and keeps the user's choice in localStorage.
   Supports three themes: "light" (default), "dark", and "luxury".
   Does not touch any other site functionality.
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'tt-theme';
  var root = document.documentElement;
  var LUXURY_META_COLOR = '#F3FAFF';
  var DARK_META_COLOR = '#15120E';

  function getStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function setStored(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* ignore */ }
  }

  function currentTheme() {
    var t = root.getAttribute('data-theme');
    return (t === 'dark' || t === 'luxury') ? t : 'light';
  }

  function syncButtons(theme) {
    var darkToggles = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < darkToggles.length; i++) {
      darkToggles[i].setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
    var luxuryToggles = document.querySelectorAll('[data-luxury-toggle]');
    for (var j = 0; j < luxuryToggles.length; j++) {
      luxuryToggles[j].setAttribute('aria-pressed', theme === 'luxury' ? 'true' : 'false');
    }
  }

  function syncThemeColorMeta(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    if (!meta.getAttribute('data-default-content')) {
      meta.setAttribute('data-default-content', meta.getAttribute('content') || '#8B2E3A');
    }
    if (theme === 'dark') {
      meta.setAttribute('content', DARK_META_COLOR);
    } else if (theme === 'luxury') {
      meta.setAttribute('content', LUXURY_META_COLOR);
    } else {
      meta.setAttribute('content', meta.getAttribute('data-default-content'));
    }
  }

  function setTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (persist) setStored(theme);
    syncButtons(theme);
    syncThemeColorMeta(theme);
  }

  // Sync UI to whatever the anti-flash head script already applied.
  syncButtons(currentTheme());
  syncThemeColorMeta(currentTheme());

  document.addEventListener('click', function (e) {
    var darkBtn = e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
    if (darkBtn) {
      var nextDark = currentTheme() === 'dark' ? 'light' : 'dark';
      setTheme(nextDark, true);
      return;
    }
    var luxuryBtn = e.target.closest ? e.target.closest('[data-luxury-toggle]') : null;
    if (luxuryBtn) {
      var nextLuxury = currentTheme() === 'luxury' ? 'light' : 'luxury';
      setTheme(nextLuxury, true);
      return;
    }
  });

  // If the user hasn't made an explicit choice yet, keep following the
  // system's light/dark setting live.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function (e) {
      if (getStored()) return;
      setTheme(e.matches ? 'dark' : 'light', false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }
})();