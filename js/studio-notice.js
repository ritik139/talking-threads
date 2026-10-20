/**
 * Talking-Thread — "studio booked until <date>" notices
 * -----------------------------------------------------
 * The date is NOT hard-coded: it is read from the backend
 * (GET /api/settings/studio-notice), where the admin sets it from the
 * dashboard's "Studio Notice" tab. Change it there and every place below
 * updates by itself.
 *
 * Where it appears (cart.html only):
 *   1. Slim black banner at the very top of the page
 *   2. Small note right above "Proceed to Checkout"
 *   3. Small note above "Payment Policy" inside the checkout popup
 *   4. One line on the thank-you screen after the order is confirmed
 *
 * The banner and the two notes stay until the customer closes them with the
 * cross button (no auto-hide, so the delivery date is never missed). The
 * banner stays closed for the rest of the browser session; the popup note
 * comes back each time the checkout popup is opened.
 *
 * The date comes from js/studio-live.js (shared with the home-page popup). It
 * is pushed live when the admin saves, and re-checked when the customer returns
 * to the tab and when the checkout popup opens, so a page that is already open
 * picks up a date change without a refresh. When the chosen date arrives (7 Nov
 * = from 12:00 am India time) every notice here disappears on its own.
 *
 * Standalone: it never touches js/main.js or the checkout logic; it only
 * inserts extra elements next to existing ones.
 */
(function () {
  'use strict';

  var BANNER_KEY = 'tt_studio_banner_closed';

  function store(action, value) {
    try {
      if (action === 'get') return window.sessionStorage.getItem(BANNER_KEY);
      if (action === 'set') window.sessionStorage.setItem(BANNER_KEY, value);
    } catch (e) { /* storage blocked — banner simply reappears next load */ }
    return null;
  }

  /* ----------------------------------------------------------- markup */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function icon(kind) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('class', 'tt-ic');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var parts = kind === 'close'
      ? [{ tag: 'path', d: 'M6 6l12 12M18 6L6 18' }]
      : [{ tag: 'rect', x: '3.5', y: '5', width: '17', height: '15.5', rx: '2' },
         { tag: 'path', d: 'M3.5 10h17M8 3v4M16 3v4' }];
    parts.forEach(function (p) {
      var el = document.createElementNS(SVG_NS, p.tag);
      Object.keys(p).forEach(function (k) { if (k !== 'tag') el.setAttribute(k, p[k]); });
      s.appendChild(el);
    });
    return s;
  }

  function dateEl(label) {
    var b = document.createElement('strong');
    b.className = 'tt-date';
    b.textContent = label;
    return b;
  }

  function closeBtn(onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tt-x';
    b.setAttribute('aria-label', 'Close this notice');
    b.appendChild(icon('close'));
    b.addEventListener('click', onClick);
    return b;
  }

  function textWith(label, before, after) {
    var span = document.createElement('span');
    span.className = 'tt-text';
    span.appendChild(document.createTextNode(before));
    span.appendChild(dateEl(label));
    span.appendChild(document.createTextNode(after));
    return span;
  }

  var MAIN_BEFORE = 'Ravina and her artisans are fully booked until ';
  var MAIN_AFTER = '. Order today and your piece will reach you after, made with extra love.';

  function buildBanner(label) {
    var el = document.createElement('div');
    el.className = 'tt-banner';
    el.setAttribute('role', 'status');
    el.setAttribute('data-studio-notice', 'banner');
    el.appendChild(textWith(label, MAIN_BEFORE, MAIN_AFTER));
    el.appendChild(closeBtn(function () {
      store('set', currentLabel);
      dismiss(el);
    }));
    return el;
  }

  function buildNote(label) {
    var el = document.createElement('div');
    el.className = 'tt-note';
    el.setAttribute('role', 'status');
    el.setAttribute('data-studio-notice', 'note');
    el.appendChild(icon('calendar'));
    el.appendChild(textWith(label, MAIN_BEFORE, MAIN_AFTER));
    el.appendChild(closeBtn(function () { dismiss(el); }));
    return el;
  }

  function buildThanks(label) {
    var el = document.createElement('div');
    el.className = 'tt-thanks';
    el.setAttribute('role', 'status');
    el.setAttribute('data-studio-notice', 'thanks');
    el.appendChild(icon('calendar'));
    el.appendChild(textWith(label,
      'Thank you for waiting for something made just for you. Your piece will reach you after ',
      '.'));
    return el;
  }

  /* ------------------------------------------------------- show / hide */

  function show(el) {
    if (!el) return;
    el.hidden = false;
    el.style.maxHeight = '';
    el.classList.remove('is-in', 'is-leaving');
    delete el.dataset.closed;
    void el.offsetWidth;
    requestAnimationFrame(function () { el.classList.add('is-in'); });
  }

  function hideNow(el) {
    if (!el) return;
    el.hidden = true;
    el.style.maxHeight = '';
    el.classList.remove('is-in', 'is-leaving');
  }

  // Customer pressed the cross: collapse smoothly, then take it out of the layout.
  function dismiss(el) {
    if (!el || el.hidden) return;
    el.dataset.closed = '1';
    el.style.maxHeight = el.offsetHeight + 'px';
    void el.offsetHeight;
    el.classList.remove('is-in');
    el.classList.add('is-leaving');
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      if (el.dataset.closed === '1') hideNow(el);
    }
    el.addEventListener('transitionend', function (e) {
      if (e.target === el && e.propertyName === 'max-height') finish();
    });
    setTimeout(finish, 600);
  }

  /* --------------------------------------------------------- placement */

  var ui = null;            // { banner, cartNote, modalNote, thanks, modalEl }
  var currentLabel = '';
  var active = false;

  function modalIsOpen() {
    return !!(ui && ui.modalEl && !ui.modalEl.classList.contains('is-hidden'));
  }

  function place(label) {
    var set = { banner: null, cartNote: null, modalNote: null, thanks: null, modalEl: null };

    // 1) slim banner at the very top of the page
    var page = document.getElementById('page') || document.body;
    set.banner = buildBanner(label);
    page.insertBefore(set.banner, page.firstChild);

    // 2) cart page — right above "Proceed to Checkout"
    var checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn && checkoutBtn.parentNode) {
      set.cartNote = buildNote(label);
      checkoutBtn.parentNode.insertBefore(set.cartNote, checkoutBtn);
    }

    // 3) checkout popup — right above the "Payment Policy" box
    var modal = document.getElementById('checkoutModal');
    var pay = modal && modal.querySelector('.pay-notice');
    if (modal && pay && pay.parentNode) {
      set.modalEl = modal;
      set.modalNote = buildNote(label);
      set.modalNote.hidden = true;
      pay.parentNode.insertBefore(set.modalNote, pay);
      var wasOpen = false;
      var sync = function () {
        var open = !modal.classList.contains('is-hidden');
        if (open && !wasOpen) {
          if (active) show(set.modalNote);   // popup just opened -> show the note again
          refresh();                         // and make sure the date is still current
        }
        wasOpen = open;
      };
      new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
    }

    // 4) thank-you screen — shown with the confirmation panel
    var confirmation = document.getElementById('orderConfirmation');
    if (confirmation) {
      set.thanks = buildThanks(label);
      var details = document.getElementById('ocDetails');
      if (details && details.parentNode === confirmation) details.insertAdjacentElement('afterend', set.thanks);
      else confirmation.appendChild(set.thanks);
    }

    ui = set;
  }

  function everything() {
    return ui ? [ui.banner, ui.cartNote, ui.modalNote, ui.thanks].filter(Boolean) : [];
  }

  function showAll() {
    if (store('get') !== currentLabel) show(ui.banner);
    else hideNow(ui.banner);
    show(ui.cartNote);
    show(ui.thanks);
    if (modalIsOpen()) show(ui.modalNote);
  }

  // Apply whatever the server currently says to the page.
  function apply(state) {
    var label = state && state.active ? state.label : '';

    if (!label) {                         // no date set / date reached -> no notices at all
      active = false;
      everything().forEach(hideNow);
      return;
    }

    if (!ui) {                            // first time we have a date
      currentLabel = label;
      active = true;
      place(label);
      showAll();
      return;
    }

    if (label === currentLabel && active) return;   // nothing changed

    // date changed (or the notice is coming back): update every card and show it again
    currentLabel = label;
    active = true;
    everything().forEach(function (el) {
      Array.prototype.forEach.call(el.querySelectorAll('.tt-date'), function (d) { d.textContent = label; });
    });
    showAll();
  }

  /* -------------------------------------------------------------- boot */

  // Ask the shared live-date module to re-check now (used when the checkout popup opens).
  function refresh() {
    if (window.TTStudio) window.TTStudio.refresh();
  }

  function init() {
    if (!document.getElementById('cartList')) return; // cart.html only
    if (!window.TTStudio) return;                     // js/studio-live.js must load first
    window.TTStudio.subscribe(apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();