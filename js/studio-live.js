/**
 * Talking-Thread — "studio booked until <date>" live date (shared)
 * ----------------------------------------------------------------
 * ONE place that knows the date, used by the home-page welcome popup
 * (js/studio-popup.js) and the cart / checkout / thank-you notices
 * (js/studio-notice.js). The date comes from the backend
 * (GET /api/settings/studio-notice), where the admin sets it.
 *
 *   TTStudio.subscribe(function (s) { ... })
 *     s = { active: true|false, iso: '2026-11-07', label: '7 Nov' }
 *
 * It calls you straight away once the date is known, and again whenever
 * something changes:
 *   - the admin saves a new date        -> pushed live (Server-Sent Events)
 *   - the page was asleep / hidden      -> re-checked when it wakes up
 *   - nothing else happens              -> re-checked every 60 s as a safety net
 *   - the date arrives (7 Nov, 12:00 am India time) -> a timer flips it to
 *     { active: false } by itself, so every notice disappears with no refresh.
 *
 * "Booked until 7 Nov" is shown for every day BEFORE 7 Nov, and it is gone
 * from the first moment of 7 Nov (India time). The clock used is the server's
 * (not the visitor's phone), so a wrong device date cannot show it too long.
 */
(function () {
  'use strict';
  if (window.TTStudio) return;

  var ENDPOINT = '/api/settings/studio-notice';
  var STREAM = ENDPOINT + '/stream';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var IST_MS = 330 * 60000;            // India Standard Time = UTC+5:30
  var POLL_MS = 60000;
  var MAX_TIMEOUT = 2147000000;        // setTimeout limit (~24.8 days)

  var skew = 0;                        // server clock minus this device's clock
  var iso = '';                        // last date the server told us ('' = none)
  var loaded = false;
  var subs = [];
  var started = false;
  var expiryTimer = null;
  var source = null;
  var inFlight = false;
  var lastCheck = 0;
  var queued = null;

  function pad(n) { return String(n).padStart(2, '0'); }
  function nowMs() { return Date.now() + skew; }

  function todayIst() {
    var d = new Date(nowMs() + IST_MS);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  function parse(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) return null;
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var t = new Date(Date.UTC(y, mo - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
    return { y: y, mo: mo, d: d };
  }

  // '2026-11-07' -> '7 Nov'  (the year is added only when it is not the current year)
  function label(v) {
    var p = parse(v);
    if (!p) return '';
    var out = p.d + ' ' + MONTHS[p.mo - 1];
    if (p.y !== new Date(nowMs() + IST_MS).getUTCFullYear()) out += ' ' + p.y;
    return out;
  }

  // Shown only while today (India time) is BEFORE the chosen date.
  function isActive(v) { return !!parse(v) && v > todayIst(); }

  function state() {
    var on = isActive(iso);
    return { active: on, iso: on ? iso : '', label: on ? label(iso) : '' };
  }

  function emit() {
    var s = state();
    subs.slice().forEach(function (fn) { try { fn(s); } catch (e) { /* one bad subscriber must not stop the rest */ } });
    schedule();
  }

  // Wake up exactly when the date begins (India midnight) and switch everything off.
  function schedule() {
    clearTimeout(expiryTimer);
    var p = parse(iso);
    if (!p || !isActive(iso)) return;
    var ms = (Date.UTC(p.y, p.mo - 1, p.d) - IST_MS) - nowMs();
    expiryTimer = setTimeout(emit, Math.min(Math.max(ms, 0) + 1000, MAX_TIMEOUT));
  }

  function set(newIso, serverNow) {
    if (typeof serverNow === 'number' && isFinite(serverNow)) skew = serverNow - Date.now();
    iso = typeof newIso === 'string' ? newIso : '';
    loaded = true;
    emit();
  }

  /* ----------------------------------------------------------- fetching */

  function load() {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
    return fetch(ENDPOINT, { credentials: 'same-origin', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { return res.ok ? res.json() : null; })
      .catch(function () { return null; })      // null = server unreachable: keep what we have
      .then(function (data) { if (t) clearTimeout(t); return data; });
  }

  function refresh() {
    var wait = 3000 - (Date.now() - lastCheck);
    if (inFlight || wait > 0) {                  // don't spam the API: run once, a moment later
      if (!queued) queued = setTimeout(function () { queued = null; refresh(); }, Math.max(wait, 500));
      return;
    }
    inFlight = true;
    lastCheck = Date.now();
    load().then(function (data) {
      inFlight = false;
      if (data && data.notice) set(String(data.notice.date || ''), data.now);
    });
  }

  // Live push: the server tells every open page the moment the admin saves.
  function connect() {
    if (source || !('EventSource' in window)) return;
    try { source = new EventSource(STREAM); } catch (e) { source = null; return; }
    source.addEventListener('studio-notice', function (e) {
      try {
        var d = JSON.parse(e.data);
        set(String(d.date || ''), d.now);
      } catch (err) { /* ignore a malformed message */ }
    });
    source.onerror = function () {
      // The browser reconnects by itself. If it gave up completely, start a fresh stream later.
      if (source && source.readyState === 2) {
        source = null;
        setTimeout(connect, 15000);
      }
    };
  }

  function start() {
    if (started) return;
    started = true;
    refresh();
    connect();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { refresh(); if (loaded) emit(); }   // emit() re-checks the date after a sleep
    });
    window.addEventListener('focus', function () { refresh(); if (loaded) emit(); });
    window.addEventListener('online', refresh);
    window.addEventListener('pageshow', function (e) { if (e.persisted) { refresh(); if (loaded) emit(); } });
    setInterval(function () { if (!document.hidden) refresh(); }, POLL_MS);
  }

  window.TTStudio = {
    subscribe: function (fn) {
      if (typeof fn !== 'function') return;
      subs.push(fn);
      if (loaded) { try { fn(state()); } catch (e) { /* ignore */ } }
      start();
    },
    refresh: refresh,
    label: label,
    isActive: isActive
  };
})();