/**
 * Talking-Thread — admin catalogue manager
 * ----------------------------------------
 * Adds the Products and Categories tabs to the dashboard, so the catalogue is
 * editable from the browser instead of only through backend/seed/seed.js.
 *
 * Deliberately a separate file from js/admin.js: that file owns orders, the
 * live socket and notifications, and nothing here needs to touch any of it.
 * Panels are swapped in place rather than navigated to, so the order socket
 * stays connected while the admin is editing stock.
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- helpers */

  async function api(path, options) {
    var opts = options || {};
    var res;
    try {
      res = await fetch('/api' + path, Object.assign({
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      }, opts));
    } catch (err) {
      throw new Error('Could not reach the server. Please check your connection.');
    }
    var body = null;
    try { body = await res.json(); } catch (err) { /* empty body is fine */ }
    if (!res.ok) {
      var error = new Error((body && body.message) || ('Request failed (' + res.status + ')'));
      error.status = res.status;
      throw error;
    }
    return body;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function rupees(value) {
    return '\u20B9' + Number(value || 0).toLocaleString('en-IN');
  }

  function el(id) { return document.getElementById(id); }

  function openModal(node) {
    node.hidden = false;
    document.body.classList.add('admin-modal-open');
  }

  function closeModal(node) {
    node.hidden = true;
    document.body.classList.remove('admin-modal-open');
  }

  function showError(node, message) {
    node.textContent = message;
    node.hidden = false;
  }

  function clearError(node) {
    node.textContent = '';
    node.hidden = true;
  }

  // Thread colours the shop's swatch filter understands. Kept in sync with the
  // .swatch[data-color] list in shop.html — a colour outside this set would save
  // fine but render as a grey blank swatch on the product card.
  var THREAD_COLOURS = [
    { value: 'maroon', label: 'Deep Maroon' },
    { value: 'gold', label: 'Antique Gold' },
    { value: 'sage', label: 'Sage Green' },
    { value: 'ivory', label: 'Ivory' },
    { value: 'midnight', label: 'Midnight Blue' },
    { value: 'blush', label: 'Blush Pink' }
  ];

  /* ------------------------------------------------------------ shared state */

  var categories = [];   // [{ _id, name, label, order, isActive, count }]
  var products = [];

  /* ------------------------------------------------------- panel switching   */

  var VIEWS = {
    orders: {
      title: 'Orders',
      subtitle: 'View every customer order, and update fulfilment or payment status.'
    },
    products: {
      title: 'Products',
      subtitle: 'Add, edit, photograph and retire pieces. Changes are live on the shop immediately.'
    },
    categories: {
      title: 'Categories',
      subtitle: 'Your own shop categories. These drive the Shop page filter and its counts.'
    }
  };

  var loaded = { products: false, categories: false };

  function switchView(view) {
    if (!VIEWS[view]) return;

    Array.prototype.forEach.call(document.querySelectorAll('[data-admin-view]'), function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-admin-view') === view);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-view-panel]'), function (panel) {
      panel.hidden = panel.getAttribute('data-view-panel') !== view;
    });

    var title = el('adminViewTitle');
    var subtitle = el('adminViewSubtitle');
    if (title) title.textContent = VIEWS[view].title;
    if (subtitle) subtitle.textContent = VIEWS[view].subtitle;

    // Load on first visit only — re-fetching on every tab click would throw away
    // an in-progress edit and hammer the API for no reason.
    if (view === 'categories' && !loaded.categories) { loaded.categories = true; loadCategories(); }
    if (view === 'products' && !loaded.products) { loaded.products = true; loadProducts(); }
  }

  /* ------------------------------------------------------------- categories  */

  var cmModal = el('cmModal');
  var cmList = el('cmList');
  var cmForm = el('cmForm');
  var cmError = el('cmError');

  function renderCategories() {
    if (!categories.length) {
      cmList.innerHTML = '<div class="admin-empty">No categories yet — add your first one.</div>';
      return;
    }

    cmList.innerHTML = categories.map(function (cat) {
      var hidden = cat.isActive ? '' : '<span class="admin-badge">hidden</span>';
      return '<div class="admin-card" data-cat-id="' + esc(cat._id) + '">' +
        '<div class="admin-card-main">' +
          '<div class="admin-card-title">' + esc(cat.label || cat.name) + ' ' + hidden + '</div>' +
          '<div class="admin-card-meta">Stored as "' + esc(cat.name) + '" &middot; ' +
            cat.count + ' product' + (cat.count === 1 ? '' : 's') +
            ' &middot; sort ' + Number(cat.order) + '</div>' +
        '</div>' +
        '<div class="admin-card-actions">' +
          '<button type="button" class="admin-btn admin-btn-sm" data-act="edit-cat">Edit</button>' +
          '<button type="button" class="admin-btn admin-btn-sm admin-btn-danger" data-act="delete-cat">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  async function loadCategories() {
    cmList.innerHTML = '<div class="admin-loading">Loading categories…</div>';
    try {
      var data = await api('/categories/admin/all');
      categories = data.categories || [];
      renderCategories();
      syncCategoryInputs();
    } catch (err) {
      cmList.innerHTML = '<div class="admin-error">' + esc(err.message) + '</div>';
    }
  }

  function openCategoryModal(cat) {
    clearError(cmError);
    el('cmModalTitle').textContent = cat ? 'Edit Category' : 'Add Category';
    el('cmId').value = cat ? cat._id : '';
    el('cmName').value = cat ? cat.name : '';
    el('cmLabel').value = cat ? (cat.label === cat.name ? '' : cat.label) : '';
    el('cmOrder').value = cat ? cat.order : 100;
    el('cmActive').checked = cat ? !!cat.isActive : true;
    openModal(cmModal);
    el('cmName').focus();
  }

  cmForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearError(cmError);

    var id = el('cmId').value;
    var payload = {
      name: el('cmName').value.trim(),
      label: el('cmLabel').value.trim(),
      order: Number(el('cmOrder').value) || 0,
      isActive: el('cmActive').checked
    };

    var save = el('cmSave');
    save.disabled = true;
    save.textContent = 'Saving…';
    try {
      if (id) {
        await api('/categories/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/categories', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeModal(cmModal);
      await loadCategories();
      // A renamed category changes what each product stores, so the loaded
      // product list is now out of date — refresh it if it was ever opened.
      if (loaded.products) await loadProducts();
    } catch (err) {
      showError(cmError, err.message);
    } finally {
      save.disabled = false;
      save.textContent = 'Save Category';
    }
  });

  cmList.addEventListener('click', async function (event) {
    var button = event.target.closest('[data-act]');
    if (!button) return;

    var card = button.closest('[data-cat-id]');
    var cat = categories.find(function (c) { return c._id === card.getAttribute('data-cat-id'); });
    if (!cat) return;

    if (button.getAttribute('data-act') === 'edit-cat') {
      openCategoryModal(cat);
      return;
    }

    if (!window.confirm('Delete the category "' + (cat.label || cat.name) + '"? This cannot be undone.')) return;

    button.disabled = true;
    try {
      await api('/categories/' + encodeURIComponent(cat._id), { method: 'DELETE' });
      await loadCategories();
    } catch (err) {
      window.alert(err.message);
    } finally {
      button.disabled = false;
    }
  });

  el('cmAddBtn').addEventListener('click', function () { openCategoryModal(null); });

  /* --------------------------------------------------------------- products  */

  var pmModal = el('pmModal');
  var pmList = el('pmList');
  var pmForm = el('pmForm');
  var pmError = el('pmError');
  var pmSearch = el('pmSearch');
  var pmCategoryFilter = el('pmCategoryFilter');
  var pmThumbs = el('pmThumbs');

  var draftImages = []; // paths for the product currently open in the modal
  var pendingDeletes = []; // photos removed in this edit session, not yet deleted server-side

  // Keeps every place that lists categories (the filter dropdown and the modal's
  // tick boxes) in step with the Category collection, so a category added on the
  // Categories tab is immediately assignable here without a page reload.
  function syncCategoryInputs() {
    var active = categories.filter(function (c) { return c.isActive; });

    if (pmCategoryFilter) {
      var previous = pmCategoryFilter.value;
      pmCategoryFilter.innerHTML = '<option value="">All categories</option>' +
        categories.map(function (c) {
          return '<option value="' + esc(c.name) + '">' + esc(c.label || c.name) + '</option>';
        }).join('');
      pmCategoryFilter.value = previous;
    }

    var grid = el('pmCategories');
    if (grid) {
      var ticked = {};
      Array.prototype.forEach.call(grid.querySelectorAll('input:checked'), function (input) {
        ticked[input.value] = true;
      });
      grid.innerHTML = active.length
        ? active.map(function (c) {
            return '<label><input type="checkbox" name="pmCategory" value="' + esc(c.name) + '"' +
              (ticked[c.name] ? ' checked' : '') + '> ' + esc(c.label || c.name) + '</label>';
          }).join('')
        : '<p class="admin-hint">No categories yet — add one on the Categories tab first.</p>';
    }
  }

  function renderColourInputs(selected) {
    var chosen = selected || [];
    el('pmColors').innerHTML = THREAD_COLOURS.map(function (c) {
      return '<label><input type="checkbox" name="pmColor" value="' + c.value + '"' +
        (chosen.indexOf(c.value) !== -1 ? ' checked' : '') + '> ' + esc(c.label) + '</label>';
    }).join('');
  }

  function renderThumbs() {
    if (!draftImages.length) {
      pmThumbs.innerHTML = '<p class="admin-hint">No photos yet.</p>';
      return;
    }
    pmThumbs.innerHTML = draftImages.map(function (src, index) {
      return '<div class="admin-thumb" data-index="' + index + '">' +
        '<img src="' + esc(src) + '" alt="">' +
        (index === 0 ? '<span class="admin-thumb-flag">Main</span>' : '') +
        '<button type="button" class="admin-thumb-remove" data-act="remove-photo" aria-label="Remove photo">&times;</button>' +
        (index === 0 ? '' : '<button type="button" class="admin-thumb-main" data-act="make-main">Make main</button>') +
      '</div>';
    }).join('');
  }

  pmThumbs.addEventListener('click', function (event) {
    var button = event.target.closest('[data-act]');
    if (!button) return;
    var index = Number(button.closest('[data-index]').getAttribute('data-index'));

    if (button.getAttribute('data-act') === 'remove-photo') {
      var removed = draftImages.splice(index, 1)[0];
      renderThumbs();
      // BUG FIX (photos vanishing even when the edit was never saved): this used
      // to call DELETE /api/uploads/image the instant the × was clicked — the
      // photo's bytes were gone from MongoDB right away, regardless of whether
      // the admin went on to click "Save Product". A misclick, a validation
      // error on save (e.g. no category ticked), or just closing the modal to
      // cancel the edit still left that photo permanently deleted while the
      // product document kept pointing at it — showing up as a broken/missing
      // image on the live site, repeatedly, for edits that were never even
      // confirmed. Fix: only remember the removal here; the actual server-side
      // delete now fires from the form's submit handler, and only after the
      // save itself has succeeded.
      if (removed) pendingDeletes.push(removed);
    } else {
      // Promote to first: the shop grid and product page both use images[0].
      draftImages.unshift(draftImages.splice(index, 1)[0]);
      renderThumbs();
    }
  });

  function readAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('Could not read ' + file.name)); };
      reader.readAsDataURL(file);
    });
  }

  el('pmPhotoBtn').addEventListener('click', function () { el('pmPhotoInput').click(); });

  el('pmPhotoInput').addEventListener('change', async function (event) {
    var files = Array.prototype.slice.call(event.target.files || []);
    if (!files.length) return;

    var status = el('pmUploadStatus');
    clearError(pmError);

    for (var i = 0; i < files.length; i++) {
      status.textContent = 'Uploading ' + (i + 1) + ' of ' + files.length + '…';
      try {
        var dataUrl = await readAsDataUrl(files[i]);
        var result = await api('/uploads/image', {
          method: 'POST',
          body: JSON.stringify({ dataUrl: dataUrl, filename: files[i].name })
        });
        draftImages.push(result.path);
        renderThumbs();
      } catch (err) {
        showError(pmError, err.message);
        break;
      }
    }

    status.textContent = '';
    // Reset so re-picking the same file still fires a change event.
    event.target.value = '';
  });

  function matchesFilters(product) {
    var term = (pmSearch.value || '').trim().toLowerCase();
    var category = pmCategoryFilter.value;
    if (term && String(product.name || '').toLowerCase().indexOf(term) === -1) return false;
    if (category && (product.category || []).indexOf(category) === -1) return false;
    return true;
  }

  function renderProducts() {
    var visible = products.filter(matchesFilters);
    el('pmCount').textContent = visible.length + ' product' + (visible.length === 1 ? '' : 's');

    if (!visible.length) {
      pmList.innerHTML = '<div class="admin-empty">No products match.</div>';
      return;
    }

    pmList.innerHTML = visible.map(function (product) {
      var image = (product.images && product.images[0]) || '';
      var cats = (product.category || []).join(', ');
      var flags = [];
      if (!product.isActive) flags.push('<span class="admin-badge">hidden</span>');
      if (product.isNewArrival) flags.push('<span class="admin-badge">new</span>');
      if (product.isFeatured) flags.push('<span class="admin-badge">featured</span>');

      return '<div class="admin-card" data-product-id="' + esc(product._id) + '">' +
        '<div class="admin-card-thumb">' +
          (image ? '<img src="' + esc(image) + '" alt="" loading="lazy">' : '<span>No photo</span>') +
        '</div>' +
        '<div class="admin-card-main">' +
          '<div class="admin-card-title">' + esc(product.name) + ' ' + flags.join(' ') + '</div>' +
          '<div class="admin-card-meta">' + rupees(product.price) + ' &middot; ' + esc(cats || 'uncategorised') + '</div>' +
        '</div>' +
        '<div class="admin-card-actions">' +
          '<button type="button" class="admin-btn admin-btn-sm" data-act="edit-product">Edit</button>' +
          '<button type="button" class="admin-btn admin-btn-sm" data-act="toggle-product">' +
            (product.isActive ? 'Hide' : 'Show') +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  async function loadProducts() {
    pmList.innerHTML = '<div class="admin-loading">Loading products…</div>';
    try {
      // Categories are needed to render the tick boxes and the filter dropdown,
      // so make sure they exist even if the Categories tab was never opened.
      if (!categories.length) {
        var catData = await api('/categories/admin/all');
        categories = catData.categories || [];
        loaded.categories = true;
        renderCategories();
      }
      syncCategoryInputs();

      var data = await api('/products/admin/all');
      products = data.products || [];
      renderProducts();
    } catch (err) {
      pmList.innerHTML = '<div class="admin-error">' + esc(err.message) + '</div>';
    }
  }

  function openProductModal(product) {
    clearError(pmError);
    el('pmModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
    el('pmId').value = product ? product._id : '';
    el('pmName').value = product ? product.name : '';
    el('pmPrice').value = product ? product.price : '';
    el('pmCompare').value = product && product.compareAtPrice ? product.compareAtPrice : '';
    el('pmShortDesc').value = product ? (product.shortDescription || '') : '';
    el('pmDesc').value = product ? (product.description || '') : '';
    el('pmSizes').value = product ? (product.sizes || []).join(', ') : '';
    el('pmAvailability').value = product ? (product.availability || 'Made to Order') : 'Made to Order';
    el('pmNew').checked = product ? !!product.isNewArrival : false;
    el('pmFeatured').checked = product ? !!product.isFeatured : false;
    el('pmBest').checked = product ? !!product.isBestSeller : false;
    el('pmActive').checked = product ? !!product.isActive : true;

    draftImages = product ? (product.images || []).slice() : [];
    // Start a clean slate every time the modal opens — any removal from a
    // previous, unsaved edit of a different product must never carry over.
    pendingDeletes = [];
    renderThumbs();
    renderColourInputs(product ? product.colors : []);

    syncCategoryInputs();
    var assigned = product ? (product.category || []) : [];
    Array.prototype.forEach.call(el('pmCategories').querySelectorAll('input'), function (input) {
      input.checked = assigned.indexOf(input.value) !== -1;
    });

    openModal(pmModal);
    el('pmName').focus();
  }

  pmForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearError(pmError);

    var chosenCategories = Array.prototype.map.call(
      el('pmCategories').querySelectorAll('input:checked'),
      function (input) { return input.value; }
    );
    if (!chosenCategories.length) {
      showError(pmError, 'Please tick at least one category.');
      return;
    }

    var payload = {
      name: el('pmName').value.trim(),
      price: Number(el('pmPrice').value),
      compareAtPrice: el('pmCompare').value ? Number(el('pmCompare').value) : null,
      category: chosenCategories,
      images: draftImages,
      shortDescription: el('pmShortDesc').value.trim(),
      description: el('pmDesc').value.trim(),
      sizes: el('pmSizes').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      colors: Array.prototype.map.call(
        el('pmColors').querySelectorAll('input:checked'),
        function (input) { return input.value; }
      ),
      availability: el('pmAvailability').value,
      isNewArrival: el('pmNew').checked,
      isFeatured: el('pmFeatured').checked,
      isBestSeller: el('pmBest').checked,
      isActive: el('pmActive').checked
    };

    var id = el('pmId').value;
    var save = el('pmSave');
    save.disabled = true;
    save.textContent = 'Saving…';
    try {
      if (id) {
        await api('/products/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/products', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeModal(pmModal);
      // Only now, with the save confirmed, is it safe to actually delete the
      // photos the admin removed during this edit — best-effort and
      // non-blocking, same as before, just moved to after a real save.
      if (pendingDeletes.length) {
        pendingDeletes.forEach(function (removedPath) {
          api('/uploads/image?path=' + encodeURIComponent(removedPath), { method: 'DELETE' }).catch(function () {});
        });
        pendingDeletes = [];
      }
      await loadProducts();
      // Counts on the Categories tab move whenever stock does.
      if (loaded.categories) await loadCategories();
    } catch (err) {
      showError(pmError, err.message);
    } finally {
      save.disabled = false;
      save.textContent = 'Save Product';
    }
  });

  pmList.addEventListener('click', async function (event) {
    var button = event.target.closest('[data-act]');
    if (!button) return;

    var card = button.closest('[data-product-id]');
    var product = products.find(function (p) { return p._id === card.getAttribute('data-product-id'); });
    if (!product) return;

    if (button.getAttribute('data-act') === 'edit-product') {
      openProductModal(product);
      return;
    }

    // BUG FIX (products silently vanishing from the live shop): Edit and Hide sit
    // right next to each other in this same small button group, and unlike category
    // delete (which already confirms above), toggling a product's visibility fired
    // instantly on click with no confirmation at all. A single misclick — meaning to
    // hit Edit — would instantly pull a live, selling product off the site with zero
    // warning and no undo prompt, which looks exactly like "it just disappeared" from
    // the shopper's side. Showing a hidden product back is safe to do without asking
    // again, since that action only ever helps.
    if (product.isActive && !window.confirm('Hide "' + product.name + '" from the shop? It will disappear from the site immediately — you can show it again any time from here.')) {
      return;
    }

    button.disabled = true;
    try {
      // Hiding rather than deleting: an order already placed still references
      // this product, so removing the document outright would orphan it.
      await api('/products/' + encodeURIComponent(product._id), {
        method: 'PUT',
        body: JSON.stringify({ isActive: !product.isActive })
      });
      product.isActive = !product.isActive;
      renderProducts();
      if (loaded.categories) await loadCategories();
    } catch (err) {
      window.alert(err.message);
    } finally {
      button.disabled = false;
    }
  });

  el('pmAddBtn').addEventListener('click', function () { openProductModal(null); });
  pmSearch.addEventListener('input', renderProducts);
  pmCategoryFilter.addEventListener('change', renderProducts);

  /* ------------------------------------------------------------------ wiring */

  Array.prototype.forEach.call(document.querySelectorAll('[data-admin-view]'), function (btn) {
    btn.addEventListener('click', function () { switchView(btn.getAttribute('data-admin-view')); });
  });

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-close-modal]')) {
      var modal = event.target.closest('.admin-modal');
      if (modal) closeModal(modal);
      return;
    }
    // Click on the dim backdrop (the modal element itself, not its box) closes it.
    if (event.target.classList && event.target.classList.contains('admin-modal')) {
      closeModal(event.target);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    Array.prototype.forEach.call(document.querySelectorAll('.admin-modal'), function (modal) {
      if (!modal.hidden) closeModal(modal);
    });
  });

  renderColourInputs([]);
  renderThumbs();
})();