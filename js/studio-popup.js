/**
 * Talking-Thread — home page "booking announcement" popup
 * -------------------------------------------------------
 * Loaded on index.html ONLY. Shows the welcome popup a few seconds after the
 * page opens, then removes itself again. The date is never typed in here: it
 * comes from js/studio-live.js, i.e. from whatever the admin saved.
 *
 *  - Appears ~2.5 s after the page opens, closes by itself after ~10 s
 *    (pauses while the visitor hovers over it or touches it).
 *  - Closes with the cross, a tap outside the card, the Esc key, or by tapping
 *    "Explore collection" (which opens the Shop page).
 *  - Shown once per browser session for a given date, so coming back to the
 *    home page does not repeat it. A NEW date shows it again.
 *  - Live: if the admin saves a new date while the visitor is on the page, it
 *    pops up with the new date (no refresh). If the admin removes the date, or
 *    the date arrives, an open popup disappears immediately.
 */
(function () {
  'use strict';

  var FIRST_DELAY = 2500;     // ms after page open
  var LIVE_DELAY = 800;       // ms after a date change arrives while the page is open
  var VISIBLE_MS = 10000;     // how long it stays before closing itself
  var CTA_HREF = 'shop.html';
  var SEEN_KEY = 'tt_studio_popup_seen';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var root = null;            // the popup element while it exists
  var card = null;
  var showTimer = null;
  var closeTimer = null;
  var leaveTimer = null;
  var remaining = VISIBLE_MS;
  var startedAt = 0;
  var lastFocus = null;
  var current = '';           // label currently wanted ('' = nothing to show)
  var firstState = true;
  var waitingForVisible = false;

  /* ---------------------------------------------------------- session memory */

  function wasSeen(label) {
    try { return window.sessionStorage.getItem(SEEN_KEY) === label; } catch (e) { return false; }
  }
  function markSeen(label) {
    try { window.sessionStorage.setItem(SEEN_KEY, label); } catch (e) { /* storage blocked: may show again next load */ }
  }
  function forgetSeen() {
    try { window.sessionStorage.removeItem(SEEN_KEY); } catch (e) { /* ignore */ }
  }

  /* ----------------------------------------------------------------- markup */

  function svg(attrs, parts) {
    var s = document.createElementNS(SVG_NS, 'svg');
    Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    parts.forEach(function (p) {
      var el = document.createElementNS(SVG_NS, p.tag);
      Object.keys(p).forEach(function (k) { if (k !== 'tag') el.setAttribute(k, p[k]); });
      s.appendChild(el);
    });
    return s;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function dateEl(label) {
    var b = el('strong', 'tt-date', label);
    return b;
  }

  function build(label) {
    var wrap = el('div', 'tt-pop');
    wrap.hidden = true;
    wrap.setAttribute('data-studio-popup', '');

    var backdrop = el('div', 'tt-pop-backdrop');
    backdrop.addEventListener('click', function () { close(); });

    var c = el('div', 'tt-pop-card');
    c.setAttribute('role', 'dialog');
    c.setAttribute('aria-modal', 'false');
    c.setAttribute('aria-labelledby', 'ttPopTitle');
    c.setAttribute('aria-describedby', 'ttPopText');
    c.tabIndex = -1;

    var x = el('button', 'tt-pop-x');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close this message');
    x.appendChild(svg({ viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
      [{ tag: 'path', d: 'M6 6l12 12M18 6L6 18' }]));
    x.addEventListener('click', function () { close(); });

    // the same needle-and-thread logo as the site header
    var mark = svg({ 'class': 'tt-pop-mark', viewBox: '0 0 64 68', 'aria-hidden': 'true', focusable: 'false' }, [
      { tag: 'circle', cx: '29', cy: '35', r: '21', 'stroke-width': '1.7' },
      { tag: 'circle', cx: '29', cy: '37.4', r: '17.3', 'stroke-width': '1' },
      { tag: 'path', d: 'M45 20 L51.5 13.5', 'stroke-width': '1.7' },
      { tag: 'circle', cx: '53.5', cy: '11.5', r: '2.7', 'stroke-width': '1.3' },
      { tag: 'path', d: 'M8.5 55.5 L44.5 12', 'stroke-width': '1.3' },
      { tag: 'ellipse', cx: '41.7', cy: '15.2', rx: '2.7', ry: '1.5', transform: 'rotate(-42 41.7 15.2)', 'stroke-width': '1' },
      { tag: 'path', d: 'M40 17 C 32.5 24, 37 31.5, 27.5 35.5 C 19.5 38.8, 23 47.5, 14.5 51', 'stroke-width': '1' },
      { tag: 'path', d: 'M22 33.5 L27 39', 'stroke-width': '0.9' },
      { tag: 'path', d: 'M27 33.5 L22 39', 'stroke-width': '0.9' },
      { tag: 'path', d: 'M33 40 L36.5 44', 'stroke-width': '0.9' },
      { tag: 'path', d: 'M36.5 40 L33 44', 'stroke-width': '0.9' }
    ]);

    var eyebrow = el('p', 'tt-pop-eyebrow', 'Booking announcement');
    var title = el('h2', 'tt-pop-title', 'Hello, and welcome!');
    title.id = 'ttPopTitle';

    var text = el('p', 'tt-pop-text');
    text.id = 'ttPopText';
    text.appendChild(document.createTextNode('Ravina and her artisans are so glad you\u2019re here. Our studio is booked until '));
    text.appendChild(dateEl(label));
    text.appendChild(document.createTextNode('. Order today and your piece will reach you after, made with extra love.'));

    var pill = el('p', 'tt-pop-pill');
    pill.appendChild(svg({ viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [
      { tag: 'rect', x: '3.5', y: '5', width: '17', height: '15.5', rx: '2' },
      { tag: 'path', d: 'M3.5 10h17M8 3v4M16 3v4' }
    ]));
    pill.appendChild(document.createTextNode('Booked until '));
    pill.appendChild(dateEl(label));

    var cta = el('a', 'tt-pop-cta');
    cta.href = CTA_HREF;
    cta.appendChild(document.createTextNode('Explore collection'));
    cta.appendChild(svg({ viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
      [{ tag: 'path', d: 'M5 12h14M13 6l6 6-6 6' }]));
    cta.addEventListener('click', function () { close(true); });

    [x, mark, eyebrow, title, text, pill, cta].forEach(function (n) { c.appendChild(n); });
    wrap.appendChild(backdrop);
    wrap.appendChild(c);

    // pause the auto-close while the visitor is looking at it
    c.addEventListener('pointerenter', pause);
    c.addEventListener('pointerleave', resume);

    card = c;
    return wrap;
  }

  /* ----------------------------------------------------------- show / hide */

  function onKey(e) { if (e.key === 'Escape') close(); }

  function pause() {
    if (!closeTimer) return;
    clearTimeout(closeTimer);
    closeTimer = null;
    remaining = Math.max(1500, remaining - (Date.now() - startedAt));
  }
  function resume() {
    if (!root || closeTimer || root.classList.contains('is-leaving')) return;
    arm(remaining);
  }
  function arm(ms) {
    clearTimeout(closeTimer);
    startedAt = Date.now();
    remaining = ms;
    closeTimer = setTimeout(function () { close(); }, ms);
  }

  function open(label) {
    if (root || !label) return;
    if (document.hidden) {                       // don't pop up in a background tab
      waitingForVisible = true;
      return;
    }
    root = build(label);
    document.body.appendChild(root);
    markSeen(label);
    lastFocus = document.activeElement;
    root.hidden = false;
    void root.offsetWidth;                       // let the browser register the start state
    requestAnimationFrame(function () {
      if (!root) return;
      root.classList.add('is-in');
      try { card.focus({ preventScroll: true }); } catch (e) { /* old browser */ }
    });
    document.addEventListener('keydown', onKey);
    arm(VISIBLE_MS);
  }

  function destroy() {
    clearTimeout(closeTimer); closeTimer = null;
    clearTimeout(leaveTimer); leaveTimer = null;
    document.removeEventListener('keydown', onKey);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    if (root && lastFocus && root.contains(document.activeElement) && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    root = null;
    card = null;
  }

  // Smooth close (cross / outside tap / Esc / timer). `instant` is used when leaving the page.
  function close(instant) {
    if (!root || root.classList.contains('is-leaving')) return;
    clearTimeout(closeTimer); closeTimer = null;
    document.removeEventListener('keydown', onKey);
    if (instant) { destroy(); return; }
    var wasInside = root.contains(document.activeElement);
    root.classList.remove('is-in');
    root.classList.add('is-leaving');
    if (wasInside && lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    leaveTimer = setTimeout(destroy, 420);
  }

  function cancelPending() {
    clearTimeout(showTimer);
    showTimer = null;
    waitingForVisible = false;
  }

  /* ------------------------------------------------------- date from admin */

  function onState(s) {
    var label = s && s.active ? s.label : '';
    var delay = firstState ? FIRST_DELAY : LIVE_DELAY;
    firstState = false;

    if (!label) {                                // no date / date reached -> nothing to show at all
      current = '';
      forgetSeen();                              // if the admin later sets a date again, show it again
      cancelPending();
      if (root) destroy();
      return;
    }

    if (label === current) return;               // same date as before: nothing to do
    current = label;

    if (root) {                                  // popup is open and the date changed -> update it in place
      Array.prototype.forEach.call(root.querySelectorAll('.tt-date'), function (d) { d.textContent = label; });
      markSeen(label);
      arm(VISIBLE_MS);
      return;
    }

    cancelPending();
    if (wasSeen(label)) return;                  // already shown to this visitor for this date
    showTimer = setTimeout(function () { showTimer = null; open(current); }, delay);
  }

  function init() {
    if (!window.TTStudio) return;
    window.TTStudio.subscribe(onState);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && waitingForVisible && current && !wasSeen(current)) {
        waitingForVisible = false;
        open(current);
      }
    });
    window.addEventListener('pagehide', function () { if (root) destroy(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();