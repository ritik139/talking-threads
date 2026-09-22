/**
 * Talking-Thread — dynamic shop category filter
 * ---------------------------------------------
 * The Category checkboxes (and their counts) in shop.html used to be typed into
 * the markup by hand, which meant two things went wrong on their own:
 *   1. A category the admin adds in the dashboard never appeared in the sidebar.
 *   2. The "12 / 3 / 3 / 8" counts went stale the moment stock changed.
 *
 * This replaces that block with whatever GET /api/products/facets reports, so
 * the sidebar always mirrors the live catalogue.
 *
 * Loaded AFTER js/main.js on purpose: main.js reads the checkboxes live (it no
 * longer caches a static NodeList) and exposes window.__ttApplyShopFilters, the
 * function that refetches the grid. Both are needed here.
 */
(function () {
  'use strict';

  var mount = document.getElementById('shopCategoryFilters');
  if (!mount) return;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // Whatever the shopper had ticked before the fetch resolved has to survive the
  // re-render, or a slow connection would silently wipe their selection.
  function currentlyChecked() {
    var checked = {};
    Array.prototype.forEach.call(
      mount.querySelectorAll('input[data-filter="category"]:checked'),
      function (input) { checked[input.value] = true; }
    );
    // ?category=Wall%20Art deep links (used by the homepage tiles) must survive too.
    var fromUrl = new URLSearchParams(window.location.search).get('category') || '';
    fromUrl.split(',').map(function (v) { return v.trim(); }).filter(Boolean)
      .forEach(function (name) { checked[name] = true; });
    return checked;
  }

  function render(categories) {
    var checked = currentlyChecked();

    mount.innerHTML = categories.map(function (cat) {
      var isChecked = checked[cat.name] ? ' checked' : '';
      var count = typeof cat.count === 'number'
        ? ' <span class="filter-count">' + cat.count + '</span>'
        : '';
      return '<label><input type="checkbox" data-filter="category" value="' +
        esc(cat.name) + '"' + isChecked + '> ' + esc(cat.label || cat.name) + count + '</label>';
    }).join('');

    // A checkbox restored as checked above was never seen by main.js's initial
    // load (it rendered after that ran), so ask for a refresh — but only when
    // something is actually ticked, so the common case doesn't fire a second
    // identical request for nothing.
    if (Object.keys(checked).length && typeof window.__ttApplyShopFilters === 'function') {
      window.__ttApplyShopFilters();
    }
  }

  /**
   * The "Featured Collection" tiles above the grid carry their own hand-typed
   * "12 Pieces" labels, which drift out of date for exactly the same reason the
   * sidebar counts did. Update any tile whose heading names a real category.
   * Tiles that point at a marketing collection instead (e.g. "Bridal Edit") have
   * no matching category, so they're left untouched rather than zeroed out.
   */
  function refreshFeaturedTileCounts(categories) {
    var byLabel = {};
    categories.forEach(function (cat) {
      byLabel[(cat.label || cat.name).toLowerCase()] = cat.count;
      byLabel[cat.name.toLowerCase()] = cat.count;
    });

    Array.prototype.forEach.call(document.querySelectorAll('.shop-feat-item'), function (tile) {
      var heading = tile.querySelector('h3');
      var badge = tile.querySelector('.shop-feat-count');
      if (!heading || !badge) return;

      var count = byLabel[heading.textContent.trim().toLowerCase()];
      if (typeof count !== 'number') return;
      badge.textContent = count + ' Piece' + (count === 1 ? '' : 's');
    });
  }

  fetch('/api/products/facets', { credentials: 'include' })
    .then(function (res) {
      if (!res.ok) throw new Error('facets ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var categories = (data && data.categories) || [];
      if (!categories.length) return; // nothing to show — keep the fallback markup
      render(categories);
      refreshFeaturedTileCounts(categories);
    })
    .catch(function () {
      // Leave the hard-coded fallback list in place: a failed facets call should
      // degrade to "filters still usable", never to "no category filter at all".
    });
})();