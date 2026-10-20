/**
 * Talking-Thread — admin "Studio Notice" tab
 * ------------------------------------------
 * Lets the admin set the "studio fully booked until <date>" date that the
 * website shows in the home-page popup, on the cart page, in the checkout
 * popup and on the order confirmation screen (see js/studio-popup.js and
 * js/studio-notice.js). Saving pushes the new date to every open page live.
 *
 * Standalone on purpose: it only reads/writes /api/settings/studio-notice and
 * does not touch js/admin.js (orders / live socket) or js/admin-catalog.js
 * (products / categories) beyond the tab switch they already provide.
 */
(function () {
  'use strict';

  var tabBtn = document.querySelector('[data-admin-view="studio"]');
  var panel = document.querySelector('[data-view-panel="studio"]');
  if (!tabBtn || !panel) return;

  var input = document.getElementById('studioDate');
  var saveBtn = document.getElementById('studioSave');
  var clearBtn = document.getElementById('studioClear');
  var statusEl = document.getElementById('studioStatus');
  var previewEl = document.getElementById('studioPreview');
  var errorEl = document.getElementById('studioError');
  var okEl = document.getElementById('studioOk');

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var savedDate = '';   // what is currently stored on the server
  var loaded = false;

  async function api(path, options) {
    var res;
    try {
      res = await fetch('/api' + path, Object.assign({
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      }, options || {}));
    } catch (err) {
      throw new Error('Could not reach the server. Please check your connection.');
    }
    var body = null;
    try { body = await res.json(); } catch (err) { /* empty body is fine */ }
    if (!res.ok) throw new Error((body && body.message) || ('Request failed (' + res.status + ')'));
    return body;
  }

  // Today's date in India (the website switches notices off at 12:00 am India time).
  function todayIso() {
    var d = new Date(Date.now() + 330 * 60000);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }

  // '2026-10-25' -> '25 Oct' (same rule as the website: year only if not this year)
  function pretty(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    var out = Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1];
    if (Number(m[1]) !== new Date().getFullYear()) out += ' ' + m[1];
    return out;
  }

  function showError(msg) { okEl.hidden = true; errorEl.textContent = msg; errorEl.hidden = false; }
  function showOk(msg) { errorEl.hidden = true; okEl.textContent = msg; okEl.hidden = false; }
  function clearMessages() { errorEl.hidden = true; okEl.hidden = true; }

  function refreshPreview() {
    var iso = input.value;
    var label = pretty(iso);
    previewEl.textContent = '';
    if (!label) {
      previewEl.textContent = 'Pick a date to see how the message will read.';
      return;
    }
    previewEl.appendChild(document.createTextNode('\u201Cour studio is fully booked until '));
    var b = document.createElement('strong');
    b.textContent = label;
    previewEl.appendChild(b);
    previewEl.appendChild(document.createTextNode('\u2026 will reach you after '));
    var b2 = document.createElement('strong');
    b2.textContent = label;
    previewEl.appendChild(b2);
    previewEl.appendChild(document.createTextNode('.\u201D'));
  }

  function refreshStatus() {
    statusEl.className = 'studio-status';
    if (!savedDate) {
      statusEl.textContent = 'Not showing on the website (no date set).';
      statusEl.classList.add('is-off');
    } else if (savedDate <= todayIso()) {
      statusEl.textContent = pretty(savedDate) + ' has arrived \u2014 the notice is hidden automatically.';
      statusEl.classList.add('is-off');
    } else {
      statusEl.textContent = 'Live on the website \u2014 showing ' + pretty(savedDate) + '.';
      statusEl.classList.add('is-on');
    }
    clearBtn.disabled = !savedDate;
  }

  async function load() {
    clearMessages();
    statusEl.textContent = 'Loading\u2026';
    try {
      var data = await api('/settings/studio-notice');
      savedDate = (data && data.notice && data.notice.date) || '';
      input.value = savedDate;
      refreshPreview();
      refreshStatus();
    } catch (err) {
      statusEl.textContent = '';
      showError(err.message);
    }
  }

  async function save(date) {
    clearMessages();
    saveBtn.disabled = true;
    clearBtn.disabled = true;
    try {
      var data = await api('/settings/studio-notice', {
        method: 'PUT',
        body: JSON.stringify({ date: date })
      });
      savedDate = (data && data.notice && data.notice.date) || '';
      input.value = savedDate;
      refreshPreview();
      refreshStatus();
      if (date && savedDate <= todayIso()) showOk('Saved, but ' + pretty(savedDate) + ' is today or earlier, so nothing will show on the website.');
      else showOk(date ? 'Saved. Every open page now shows ' + pretty(savedDate) + ' \u2014 no refresh needed.' : 'Notice removed from the website.');
    } catch (err) {
      showError(err.message);
      refreshStatus();
    } finally {
      saveBtn.disabled = false;
    }
  }

  tabBtn.addEventListener('click', function () {
    // Load on first open only, so an unsaved edit is never overwritten by a tab switch.
    if (loaded) return;
    loaded = true;
    load();
  });

  input.addEventListener('input', function () { clearMessages(); refreshPreview(); });

  saveBtn.addEventListener('click', function () {
    if (!input.value) { showError('Please pick a date first, or use \u201CRemove notice\u201D.'); return; }
    save(input.value);
  });

  clearBtn.addEventListener('click', function () {
    if (!window.confirm('Remove the notice from the website? Customers will no longer see the "studio booked" message.')) return;
    save('');
  });
})();