/* ==========================================================================
   Talking-Thread — Night Mode / Dark Mode toggle
   Works with the inline anti-flash script in <head> of every page, which
   already sets [data-theme] on <html> before first paint. This file only
   wires up the toggle buttons and keeps the user's choice in localStorage.
   Does not touch any other site functionality.
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'tt-theme';
  var root = document.documentElement;

  function getStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function setStored(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* ignore */ }
  }

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function syncButtons(theme) {
    var pressed = theme === 'dark' ? 'true' : 'false';
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-pressed', pressed);
    }
  }

  function syncThemeColorMeta(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    if (!meta.getAttribute('data-default-content')) {
      meta.setAttribute('data-default-content', meta.getAttribute('content') || '#8B2E3A');
    }
    meta.setAttribute('content', theme === 'dark' ? '#15120E' : meta.getAttribute('data-default-content'));
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
    var btn = e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
    if (!btn) return;
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next, true);
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