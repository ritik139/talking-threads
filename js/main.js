/* ==========================================================================
   Talking-Thread — shared front-end behaviour
   No backend: cart & wishlist state is persisted to localStorage only.
   Loaded on every page via <script src="js/main.js" defer></script>.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- WhatsApp floating chat button (appears on every page) ---------- */
  // NOTE: replace WHATSAPP_PHONE with the real business number in international
  // format, digits only, no "+", no spaces (e.g. 919876543210 for an Indian number).
  (function initWhatsAppFloat() {
    const WHATSAPP_PHONE = '9024655202'; // <-- TODO: put the real WhatsApp number here
    const WHATSAPP_MESSAGE = "Hi, I'm interested in your embroidery products.";
    const waUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

    const link = document.createElement('a');
    link.href = waUrl;
    link.className = 'wa-float';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Chat with us on WhatsApp');
    link.innerHTML = `
      <span class="wa-float-tooltip">Chat with us</span>
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16.004 3C9.377 3 4 8.377 4 15.004c0 2.363.685 4.566 1.87 6.42L4 29l7.77-1.84a11.93 11.93 0 004.234.77H16c6.627 0 12-5.377 12-12.003C28 8.377 22.627 3 16.004 3zm6.965 17.02c-.294.826-1.457 1.513-2.386 1.71-.635.134-1.463.24-4.252-.913-3.567-1.476-5.86-5.09-6.04-5.324-.177-.234-1.443-1.92-1.443-3.664 0-1.744.914-2.6 1.238-2.958.324-.358.71-.448.947-.448.236 0 .473.002.68.012.218.01.512-.083.8.61.294.71.998 2.454 1.086 2.633.088.18.147.393.03.627-.118.235-.177.383-.353.588-.176.206-.37.46-.53.617-.176.176-.36.367-.155.72.206.353.914 1.51 1.963 2.446 1.35 1.204 2.49 1.578 2.843 1.755.353.176.56.147.766-.088.206-.235.883-1.03 1.118-1.383.235-.353.47-.294.794-.176.324.118 2.06.97 2.413 1.147.353.176.588.264.676.412.088.147.088.85-.206 1.676z"/></svg>
    `;

    document.body.appendChild(link);
  })();

  /* ---------- Mobile nav (left-side off-canvas drawer) ---------- */
  const menuToggle = document.querySelector('.menu-toggle');
  const mobilePanel = document.querySelector('.mobile-panel');
  const siteHeader = document.querySelector('.site-header');
  if (menuToggle && mobilePanel) {
    // Move the panel to be a direct child of <body>. It was nested inside
    // .site-header, which has `backdrop-filter`; that property makes an
    // element the containing block for its fixed-position descendants, so
    // a fixed .mobile-panel left in place would be positioned/sized against
    // the (short) header instead of the full viewport. Moving it out fixes
    // that without touching any page's HTML structure.
    document.body.appendChild(mobilePanel);

    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-panel-backdrop';
    document.body.appendChild(backdrop);

    const setPanelTop = () => {
      const headerBottom = siteHeader ? siteHeader.getBoundingClientRect().bottom : 0;
      document.documentElement.style.setProperty('--mobile-panel-top', `${Math.max(headerBottom, 0)}px`);
    };
    setPanelTop();
    window.addEventListener('resize', setPanelTop);

    const closeMenu = () => {
      menuToggle.classList.remove('open');
      mobilePanel.classList.remove('open');
      backdrop.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('mobile-menu-open');
      mobilePanel.setAttribute('inert', '');
    };
    const openMenu = () => {
      setPanelTop();
      menuToggle.classList.add('open');
      mobilePanel.classList.add('open');
      backdrop.classList.add('open');
      menuToggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('mobile-menu-open');
      mobilePanel.removeAttribute('inert');
    };

    mobilePanel.setAttribute('inert', '');

    menuToggle.addEventListener('click', () => {
      const isOpen = menuToggle.classList.contains('open');
      isOpen ? closeMenu() : openMenu();
    });
    backdrop.addEventListener('click', closeMenu);
    mobilePanel.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuToggle.classList.contains('open')) closeMenu();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && menuToggle.classList.contains('open')) closeMenu();
    });
  }

  /* ---------- Ticker duplication for seamless loop ---------- */
  document.querySelectorAll('.ticker').forEach(t => {
    t.innerHTML += t.innerHTML;
  });

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---------- Toast ---------- */
  window.showToast = function (message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span></span>';
      document.body.appendChild(toast);
    }
    toast.querySelector('span').textContent = message;
    toast.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  };

  /* ============================================================
     API — talks to the Node/Express/MongoDB backend.
     Cart & wishlist still live in localStorage first (so every
     existing render() function above keeps working exactly as
     before, synchronously) and are synced to the server in the
     background whenever someone is signed in.
     ============================================================ */
  const API_BASE = '/api';
  const API_TIMEOUT_MS = 15000; // fail with a clear message instead of spinning forever

  async function apiRequest(path, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(API_BASE + path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...options,
        signal: controller.signal
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') {
        // Ambiguous: the request may have already reached and been applied by the server
        // before the client gave up waiting on the response. Never safe to auto-retry a
        // non-idempotent call (like a qty delta) in this case -- it could double-apply.
        const timeoutErr = new Error('The server took too long to respond. Please check your connection and try again.');
        timeoutErr.retryable = false;
        throw timeoutErr;
      }
      // fetch() only throws for network-level failures — the API server is unreachable, so
      // the request never left the client. Safe to retry: there's nothing on the server side
      // that could get double-applied.
      const unreachableErr = new Error('Could not reach the server. Please make sure the backend is running and try again.');
      unreachableErr.retryable = true;
      throw unreachableErr;
    } finally {
      clearTimeout(timeoutId);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const message = (data && data.message) || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  const Auth = {
    getUser() {
      try { return JSON.parse(localStorage.getItem('tt_user') || 'null'); } catch (e) { return null; }
    },
    setUser(user) { localStorage.setItem('tt_user', JSON.stringify(user)); },
    clearUser() { localStorage.removeItem('tt_user'); },
    isLoggedIn() { return !!Auth.getUser(); },

    async register(name, email, password, newsletterSubscribed) {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, newsletterSubscribed })
      });
      Auth.setUser(data.user);
      await Auth.mergeGuestDataIntoAccount();
      return data;
    },

    async login(email, password, rememberMe = true) {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, rememberMe })
      });
      Auth.setUser(data.user);
      await Auth.mergeGuestDataIntoAccount();
      return data;
    },

    async logout() {
      try { await apiRequest('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore network errors on logout */ }
      Auth.clearUser();
    },

    // Pushes whatever is currently in the guest (localStorage) cart/wishlist up to the
    // account that was just signed into, then pulls back the merged, canonical version.
    async mergeGuestDataIntoAccount() {
      const guestCart = Store.getCart();
      const guestWishlist = Store.getWishlist();
      try {
        if (guestCart.length) await apiRequest('/cart/merge', { method: 'POST', body: JSON.stringify({ items: guestCart }) });
        if (guestWishlist.length) await apiRequest('/wishlist/merge', { method: 'POST', body: JSON.stringify({ items: guestWishlist }) });
      } catch (e) { /* best-effort merge */ }
      await Auth.pullServerState(true);
    },

    // Pulls the server's cart/wishlist and uses them to FILL IN local state — used after
    // login/register (forceOverwrite=true, since a merge just happened and the server
    // copy is authoritative) and again on every page load while signed in, for cross-device
    // sync (forceOverwrite=false).
    //
    // IMPORTANT: on plain page loads (forceOverwrite=false) this must never overwrite a
    // non-empty local cart/wishlist. Add to Cart writes to localStorage immediately and
    // only *afterwards* fires a best-effort POST to persist it to the DB in the background.
    // If the very next page load's GET here resolved before that POST finished saving,
    // blindly overwriting localStorage with the (still-stale) server copy would erase the
    // item the person just added — which was exactly the "item added, but Cart page shows
    // empty" bug. Only pulling into an *empty* local cart avoids that race entirely, while
    // still doing real cross-device sync for a fresh session.
    async pullServerState(forceOverwrite = false) {
      try {
        const [cartData, wishlistData] = await Promise.all([
          apiRequest('/cart'),
          apiRequest('/wishlist')
        ]);
        if (forceOverwrite || Store.getCart().length === 0) Store.setCart(cartData.cart || []);
        if (forceOverwrite || Store.getWishlist().length === 0) Store.setWishlist(wishlistData.wishlist || []);
      } catch (e) { /* if this fails (e.g. session expired) just keep local state */ }
    }
  };
  window.TTAuth = Auth;

  /* ============================================================
     STORE STATE (cart + wishlist) — persisted in localStorage
     ============================================================ */
  function genId(prefix) {
    return prefix + '_' + Date.now() + Math.random().toString(16).slice(2);
  }

  // ROOT CAUSE FIX (qty shown correctly on cart.html but wrong on order/My Orders):
  // addToCart/removeFromCart/updateCartQty below all write to localStorage synchronously
  // (so the cart UI is instantly correct) and then fire their server sync as a
  // fire-and-forget request -- never awaited by the caller. That's fine for rendering, but
  // checkout (POST /api/orders) deliberately re-prices from the SERVER'S cart, not from
  // localStorage (a client-supplied qty/price must never be trusted at checkout -- see
  // orderController.pricedItemsFromCart). If "Place Order" is clicked before an in-flight
  // qty PATCH has actually landed in Mongo, the order gets priced against the stale
  // server-side qty, and that wrong total is exactly what then gets frozen into the order
  // and shown on My Orders -- even though the cart page displayed the right number the whole
  // time.
  //
  // pendingCartOps tracks every outstanding cart-mutation request as a retryable operation
  // (not just a bare promise). This matters because apiRequest() is hard-bounded to
  // API_TIMEOUT_MS (15s) via AbortController, so a hung/slow/failed request always settles
  // -- but if it settles by REJECTING, a naive "just await a promise" tracker would drop it
  // from the tracked set anyway, and a second "Place Order" click would then sail through
  // flushPendingCartSync() with nothing left to wait for, silently checking out against the
  // still-stale server cart. Instead, an op is only removed from pendingCartOps once its
  // request actually SUCCEEDS; a failed op stays tracked so the next flush (whether the
  // automatic retry below, or the next time the shopper clicks "Place Order") re-runs it
  // rather than treating "it failed once" as "it's done".
  const pendingCartOps = new Set();

  // (Re)fires the op's underlying request and wires up bookkeeping. Called once when the
  // mutation first happens, and again by syncCartOp() whenever a fresh attempt is needed.
  function runCartOp(op) {
    op.settled = false;
    op.promise = op.run().then(
      () => { op.settled = true; pendingCartOps.delete(op); },
      (err) => { op.settled = true; throw err; }
    );
    op.promise.catch(() => {}); // swallow here so the fire-and-forget call site never produces an unhandled rejection
    return op.promise;
  }
  function createCartOp(run) {
    const op = { run };
    pendingCartOps.add(op);
    runCartOp(op);
    return op;
  }
  // Awaits one op's current in-flight request. If it fails, auto-retries (fresh fetch, fresh
  // 15s timeout) up to maxRetries more times -- but ONLY when the failure is one we know for
  // certain never reached the server (see apiRequest's retryable flag above); an ambiguous
  // timeout is never auto-retried, since the qty delta it carries is not safe to resend
  // blindly. Bounded either way: at most (maxRetries + 1) * API_TIMEOUT_MS for this op.
  //
  // If op.promise has already settled (this op failed on an earlier flush, or on an earlier
  // "Place Order" click), that stale promise is replaced with a brand-new request first --
  // otherwise a change that failed once would never actually get synced, and a later flush
  // would find nothing left to await and wrongly let checkout through on stale data.
  async function syncCartOp(op, maxRetries) {
    if (op.settled) runCartOp(op);
    for (let attempt = 0; ; attempt++) {
      try {
        await op.promise;
        return;
      } catch (err) {
        const canAutoRetry = attempt < maxRetries && err && err.retryable;
        if (!canAutoRetry) throw err;
        runCartOp(op);
      }
    }
  }

  const Store = {
    getCart() { return JSON.parse(localStorage.getItem('tt_cart') || '[]'); },
    setCart(c) { localStorage.setItem('tt_cart', JSON.stringify(c)); Store.refreshCounts(); },
    // Waits for every outstanding cart-mutation request (add/remove/qty change) to actually
    // finish talking to the server, retrying transient failures once. Checkout calls this
    // before POST /api/orders so pricing is never computed from a server-side cart that's
    // still catching up with the UI. All ops run concurrently (not one-at-a-time), so the
    // overall wait is bounded by a single op's worst case, not the sum of every op's.
    // Throws (checkout is then blocked with a clear "please retry" error) only if a sync
    // still hasn't succeeded after retrying -- it never silently proceeds on stale data, and
    // it never hangs past that bounded retry window.
    flushPendingCartSync(maxRetries = 1) {
      return Promise.all(Array.from(pendingCartOps).map((op) => syncCartOp(op, maxRetries)));
    },
    getWishlist() {
      const wl = JSON.parse(localStorage.getItem('tt_wishlist') || '[]');
      // Backfill a stable id on any item saved before ids existed, so remove/move-to-bag
      // (which now key off id, not array position) keep working for pre-existing wishlists.
      let changed = false;
      wl.forEach(item => {
        if (!item.id) { item.id = genId('wl'); changed = true; }
      });
      if (changed) localStorage.setItem('tt_wishlist', JSON.stringify(wl));
      return wl;
    },
    setWishlist(w) { localStorage.setItem('tt_wishlist', JSON.stringify(w)); Store.refreshCounts(); },

    addToCart(item) {
      const cart = Store.getCart();
      cart.push(Object.assign({ id: genId('ci') }, item));
      Store.setCart(cart);
      if (Auth.isLoggedIn()) {
        // keepalive: true lets this request finish in the background even if the user
        // immediately navigates away (e.g. clicking the cart icon right after adding).
        // Without it, the browser cancels in-flight fetches on page unload — so the
        // item never actually reaches the server, and the very next page load's
        // Auth.pullServerState() (which GETs the server cart and overwrites localStorage
        // with it) wipes out the item that had just been added. This was the root cause
        // of "item added, but Cart page shows empty".
        createCartOp(() => apiRequest('/cart', { method: 'POST', body: JSON.stringify(item), keepalive: true }));
      }
    },
    removeFromCart(id) {
      Store.setCart(Store.getCart().filter(i => i.id !== id));
      if (Auth.isLoggedIn()) {
        // Same navigation-cancellation risk as addToCart above.
        createCartOp(() => apiRequest('/cart/' + encodeURIComponent(id), { method: 'DELETE', keepalive: true }));
      }
    },
    updateCartQty(id, qty) {
      const before = Store.getCart().find(i => i.id === id);
      const newQty = Math.max(1, qty);
      const cart = Store.getCart().map(i => i.id === id ? Object.assign({}, i, { qty: newQty }) : i);
      Store.setCart(cart);
      if (Auth.isLoggedIn()) {
        // Sent as a relative delta (not the absolute target qty) so the server can apply it
        // with a single atomic, order-independent $inc — two rapid stepper clicks racing
        // over a real network can then never clobber each other regardless of which one's
        // round trip finishes first. (Root cause of a production-only cart/order total
        // mismatch: the old absolute-qty PATCH let an out-of-order write silently revert a
        // quantity change, and that reverted qty then got frozen into the order total at
        // checkout. See cartController.updateCartItem for the server-side fix.)
        const delta = newQty - (before ? (before.qty || 1) : 0);
        if (delta !== 0) {
          createCartOp(() => apiRequest('/cart/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ delta }), keepalive: true }));
        }
      }
    },

    toggleWishlist(product) {
      let wl = Store.getWishlist();
      const exists = wl.find(i => i.name === product.name);
      let itemForApi;
      if (exists) {
        wl = wl.filter(i => i.id !== exists.id);
        itemForApi = product;
      } else {
        const item = Object.assign({ id: genId('wl') }, product);
        wl.push(item);
        itemForApi = item;
      }
      Store.setWishlist(wl);
      if (Auth.isLoggedIn()) {
        // Same navigation-cancellation risk as the cart mutators above — keepalive lets
        // this finish even if the person navigates to wishlist.html right after toggling.
        apiRequest('/wishlist/toggle', { method: 'POST', body: JSON.stringify(itemForApi), keepalive: true }).catch(() => {});
      }
      return !exists;
    },
    isWishlisted(name) {
      return Store.getWishlist().some(i => i.name === name);
    },

    refreshCounts() {
      const cartCount = Store.getCart().reduce((sum, i) => sum + (i.qty || 1), 0);
      const wishCount = Store.getWishlist().length;
      document.querySelectorAll('[data-cart-count]').forEach(el => {
        el.textContent = cartCount;
        el.style.display = cartCount > 0 ? 'flex' : 'none';
      });
      document.querySelectorAll('[data-wish-count]').forEach(el => {
        el.textContent = wishCount;
        el.style.display = wishCount > 0 ? 'flex' : 'none';
      });
    }
  };
  window.TTStore = Store;
  Store.refreshCounts();

  /* ============================================================
     PRODUCT LINKS — every product card (Shop grid, Home highlights,
     "You May Also Like") must point at ITS OWN product, not a fixed page.
     ============================================================ */
  const SWATCH_HEX = { maroon: '#7A2231', gold: '#C9A24B', sage: '#6E7A5C', ivory: '#F2EBDC', midnight: '#262E45', blush: '#D9A9A2' };
  const COLOR_LABELS = { maroon: 'Deep Maroon', gold: 'Antique Gold', sage: 'Sage Green', ivory: 'Ivory', midnight: 'Midnight Blue', blush: 'Blush Pink' };

  function slugifyName(name) {
    return (name || '').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Prefer the real database slug/id from the API; fall back to deriving one from the
  // product's name so hand-written static markup (fallback content, home page highlights)
  // still links correctly before/without the API.
  function productHref(p) {
    const key = (p && (p.slug || p._id)) || slugifyName(p && p.name);
    return 'product.html?slug=' + encodeURIComponent(key);
  }

  function productCardTemplate(p) {
    const tag = p.isNewArrival ? 'New' : (p.isBestSeller ? 'Bestseller' : '');
    const priceStr = p.displayPrice || ('₹' + Number(p.price || 0).toLocaleString('en-IN'));
    const wasStr = p.compareAtPrice ? '₹' + Number(p.compareAtPrice).toLocaleString('en-IN') : '';
    const colorDots = (p.colors || []).map(c => `<span style="--swatch:${SWATCH_HEX[c] || '#ccc'}"></span>`).join('');
    const photo = (p.images && p.images.length && p.images[0]) ? p.images[0] : '';
    const href = productHref(p);
    const mediaInner = photo
      ? `<img src="${photo}" alt="${p.name}" loading="lazy">`
      : `<div class="ph-inner">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <span class="ph-label">Product Image</span>
        <span class="ph-dim">1200 x 1500</span>
      </div>`;
    return `<div class="product-card reveal in" data-href="${href}">
  <div class="pc-media">
    <div class="img-placeholder ar-portrait">
      ${mediaInner}
    </div>
    ${tag ? `<span class="pc-tag">${tag}</span>` : ''}
    <div class="pc-actions">
      <button class="pc-icon-btn" data-wish-toggle data-name="${p.name}" data-price="${priceStr}" data-img="${photo}" aria-label="Add ${p.name} to wishlist"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s-7.4-4.6-10-9.2C.5 8 2.1 4.6 5.6 4.2c2-.2 3.8.8 5 2.4 1.2-1.6 3-2.6 5-2.4 3.5.4 5.1 3.8 3.6 7.6-2.6 4.6-10 9.2-10 9.2z"/></svg></button>
      <button class="pc-icon-btn" data-quick-add data-name="${p.name}" data-price="${priceStr}" data-img="${photo}" aria-label="Quick add ${p.name} to bag"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 8h11l-1 12h-9l-1-12z"/><path d="M9.2 8V6.2a2.8 2.8 0 015.6 0V8"/></svg></button>
    </div>
  </div>
  <a href="${href}" class="pc-info">
    <div class="pc-cat">${p.category || ''}</div>
    <div class="pc-title">${p.name}</div>
    <div class="pc-price"><span>${priceStr}</span>${wasStr ? `<span class="was">${wasStr}</span>` : ''}</div>
    <div class="pc-colors">${colorDots}</div>
  </a>
</div>`;
  }

  // Progressive enhancement for cards that were hand-written into the HTML (Shop page's
  // pre-JS fallback grid, Home page highlights, Product page's "You May Also Like") —
  // gives each one a link derived from its own title instead of every card pointing at
  // the same product.html with no identifier.
  function hydrateStaticProductCardLinks(root) {
    (root || document).querySelectorAll('.product-card').forEach(card => {
      if (card.dataset.href) return; // already has a real link (came from productCardTemplate)
      const titleEl = card.querySelector('.pc-title');
      if (!titleEl) return;
      const href = productHref({ name: titleEl.textContent.trim() });
      card.dataset.href = href;
      const infoLink = card.querySelector('.pc-info');
      if (infoLink) infoLink.setAttribute('href', href);
    });
  }

  // Clicking anywhere on a product card — its image, its title, or empty space in the
  // card — opens that exact product's page. Only the wishlist / quick-add icon buttons
  // (and any real link, which already carries the correct href) opt out.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-wish-toggle], [data-quick-add]')) return;
    if (e.target.closest('a')) return; // real links navigate themselves with the same href
    const card = e.target.closest('.product-card');
    if (card && card.dataset.href) window.location.href = card.dataset.href;
  });

  /* ---------- Resolve the real product photo already shown on the page ----------
     Cart/Wishlist were showing placeholder icons because nothing captured which
     actual <img> (the same one visible on Home/Shop/Product) belonged to the item
     being added. This reads it straight from the DOM at the moment of the click,
     so it always matches whatever image is genuinely displayed there — no
     hardcoded paths, no separate "logic" to keep in sync per page. */
  function resolveProductImage(btn, mediaSelector) {
    const scope = (mediaSelector && btn.closest(mediaSelector)) || document;
    const img = scope.querySelector('img');
    const src = img && img.getAttribute('src');
    if (src) return src;
    return btn.getAttribute('data-img') || '';
  }

  /* ---------- Wishlist heart buttons anywhere (shop / product cards) ---------- */
  function bindWishToggleButtons(root) {
    (root || document).querySelectorAll('[data-wish-toggle]').forEach(btn => {
      if (btn.dataset.ttBound) return;
      btn.dataset.ttBound = '1';
      const name = btn.getAttribute('data-name') || 'Talking-Thread Piece';
      const price = btn.getAttribute('data-price') || '';
      if (Store.isWishlisted(name)) btn.classList.add('active');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const img = resolveProductImage(btn, '.pc-media');
        const added = Store.toggleWishlist({ name, price, img });
        btn.classList.toggle('active', added);
        showToast(added ? 'Added to your wishlist' : 'Removed from wishlist');
      });
    });
  }

  /* ---------- Guard against a single tap registering twice ----------
     Some mobile browsers/webviews can dispatch two click events for the same
     physical tap (e.g. a synthetic click alongside a native one) within
     milliseconds of each other. A tight window here absorbs that duplicate
     without throttling genuine fast repeat taps — someone deliberately
     tapping "+" several times to bump quantity up still registers every
     tap, since real taps are never this close together. Desktop click
     behaviour is unaffected. */
  function guardAgainstDoubleFire(fn, windowMs = 80) {
    return function (e) {
      const el = e.currentTarget;
      const now = Date.now();
      if (el.dataset.ttLastFire && now - Number(el.dataset.ttLastFire) < windowMs) return;
      el.dataset.ttLastFire = String(now);
      fn(e);
    };
  }

  /* ---------- Quick add-to-cart buttons on cards (shop grid) ---------- */
  function bindQuickAddButtons(root) {
    (root || document).querySelectorAll('[data-quick-add]').forEach(btn => {
      if (btn.dataset.ttBound) return;
      btn.dataset.ttBound = '1';
      btn.addEventListener('click', guardAgainstDoubleFire((e) => {
        e.preventDefault();
        Store.addToCart({
          name: btn.getAttribute('data-name') || 'Talking-Thread Piece',
          price: btn.getAttribute('data-price') || '',
          img: resolveProductImage(btn, '.pc-media'),
          size: 'Medium', color: 'Antique Gold', text: '—', qty: 1
        });
        showToast('Added to your bag');
      }));
    });
  }

  bindWishToggleButtons();
  bindQuickAddButtons();
  hydrateStaticProductCardLinks();

  /* ============================================================
     SHOP PAGE — search, filters, sort & pagination wired to the API
     ============================================================ */
  const productGrid = document.getElementById('productGrid');
  if (productGrid) {
    const searchInput = document.getElementById('shopSearchInput');
    const sortSelect = document.getElementById('sortSelect');
    const resetBtn = document.getElementById('resetFiltersBtn');
    const resultCountEl = document.getElementById('resultCount');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const loadMoreWrap = document.getElementById('loadMoreWrap');
    const filterInputs = document.querySelectorAll('#shopFilters [data-filter]');

    const PRICE_RANGES = {
      'under-2000': { max: 1999 },
      '2000-3500': { min: 2000, max: 3500 },
      'above-3500': { min: 3501 }
    };

    let state = { page: 1, limit: 9, products: [], pages: 1, total: 0 };
    let searchDebounce;

    function currentFilters() {
      const f = { category: [], collection: [], size: [], color: [], availability: [], price: [] };
      filterInputs.forEach(input => {
        const type = input.getAttribute('data-filter');
        const checked = input.classList.contains('swatch') ? input.classList.contains('active') : input.checked;
        if (checked) f[type].push(input.getAttribute('data-color') || input.value);
      });
      return f;
    }

    function buildQuery(page) {
      const f = currentFilters();
      const params = new URLSearchParams();
      if (searchInput && searchInput.value.trim()) params.set('q', searchInput.value.trim());
      if (f.category.length) params.set('category', f.category.join(','));
      if (f.collection.length) params.set('collection', f.collection.join(','));
      if (f.size.length) params.set('size', f.size.join(','));
      if (f.color.length) params.set('color', f.color.join(','));
      if (f.availability.length) params.set('availability', f.availability.join(','));
      if (f.price.length) {
        // combine any checked price buckets into one overall min/max the API understands
        let min = Infinity, max = -Infinity;
        f.price.forEach(key => {
          const r = PRICE_RANGES[key];
          if (!r) return;
          if (r.min !== undefined) min = Math.min(min, r.min);
          if (r.max !== undefined) max = Math.max(max, r.max);
        });
        if (min !== Infinity) params.set('minPrice', min);
        if (max !== -Infinity) params.set('maxPrice', max);
      }
      if (sortSelect) params.set('sort', sortSelect.value);
      params.set('page', page);
      params.set('limit', state.limit);
      return params.toString();
    }

    function renderResultCount() {
      if (resultCountEl) resultCountEl.textContent = `${state.total} piece${state.total === 1 ? '' : 's'}`;
    }

    function renderLoadMore() {
      if (!loadMoreWrap) return;
      loadMoreWrap.style.display = state.page < state.pages ? 'flex' : 'none';
    }

    async function fetchAndRender(page, append) {
      try {
        if (loadMoreBtn && append) { loadMoreBtn.textContent = 'Loading…'; loadMoreBtn.disabled = true; }
        const data = await apiRequest('/products?' + buildQuery(page));
        state.page = data.page || page;
        state.pages = data.pages || 1;
        state.total = data.total || 0;

        const html = (data.products || []).map(productCardTemplate).join('');
        if (append) {
          productGrid.insertAdjacentHTML('beforeend', html);
        } else {
          productGrid.innerHTML = html || '<p class="result-count">No pieces match these filters just yet.</p>';
        }
        bindWishToggleButtons(productGrid);
        bindQuickAddButtons(productGrid);
        renderResultCount();
        renderLoadMore();
      } catch (err) {
        showToast(err.message || 'Could not load products right now.');
      } finally {
        if (loadMoreBtn) { loadMoreBtn.textContent = 'Load More Pieces'; loadMoreBtn.disabled = false; }
      }
    }

    function refresh() { fetchAndRender(1, false); }

    // Search — debounced so we don't hit the API on every keystroke
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(refresh, 350);
      });
    }

    // Sort
    if (sortSelect) sortSelect.addEventListener('change', refresh);

    // Checkbox filters: category, collection, size, price, availability
    filterInputs.forEach(input => {
      if (input.tagName === 'INPUT') input.addEventListener('change', refresh);
    });

    // Colour swatches (role="checkbox" spans, not native checkboxes) toggle an "active" class.
    // Operable by mouse (click) and keyboard (Enter/Space), with aria-checked kept in sync.
    function toggleSwatch(sw) {
      sw.classList.toggle('active');
      const isActive = sw.classList.contains('active');
      sw.setAttribute('aria-checked', String(isActive));
      sw.style.outline = isActive ? '2px solid var(--thread)' : '';
      sw.style.outlineOffset = '2px';
      refresh();
    }
    document.querySelectorAll('#shopFilters .swatch[data-filter="color"]').forEach(sw => {
      sw.addEventListener('click', () => toggleSwatch(sw));
      sw.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          toggleSwatch(sw);
        }
      });
    });

    // Reset filters
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        filterInputs.forEach(input => {
          if (input.tagName === 'INPUT') input.checked = false;
        });
        document.querySelectorAll('#shopFilters .swatch').forEach(sw => {
          sw.classList.remove('active');
          sw.setAttribute('aria-checked', 'false');
          sw.style.outline = '';
        });
        if (searchInput) searchInput.value = '';
        if (sortSelect) sortSelect.value = 'featured';
        refresh();
      });
    }

    // Pagination — "Load More" appends the next page
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => fetchAndRender(state.page + 1, true));
    }

    // Initial load from the API (replaces the server-rendered fallback cards above)
    refresh();
  }

  /* ============================================================
     PRODUCT PAGE
     ============================================================ */
  const productForm = document.querySelector('.product-detail');
  if (productForm) {

    // Fills in the product-specific parts of the page (breadcrumb, title/meta, images,
    // price, description, size & colour options, add-to-cart/wishlist data) using data
    // fetched from the API — this is what makes each product page show ITS OWN product.
    function renderProductData(p) {
      const crumb = document.querySelector('.breadcrumb li[aria-current="page"]');
      if (crumb) crumb.textContent = p.name;

      document.title = `${p.name} — Talking-Thread`;
      const setMeta = (selector, attr, value) => {
        const el = document.querySelector(selector);
        if (el && value) el.setAttribute(attr, value);
      };
      const blurb = p.shortDescription || p.description || '';
      setMeta('meta[name="description"]', 'content', blurb);
      setMeta('meta[property="og:title"]', 'content', `${p.name} — Talking-Thread`);
      setMeta('meta[property="og:description"]', 'content', blurb);
      setMeta('meta[name="twitter:title"]', 'content', `${p.name} — Talking-Thread`);
      setMeta('meta[name="twitter:description"]', 'content', blurb);

      const priceStr = p.displayPrice || ('₹' + Number(p.price || 0).toLocaleString('en-IN'));

      // Images: main photo + up to 4 thumbnails (reusing the same photo where the
      // product only has one, same as the page's original static markup did),
      // split alternately across the left/right thumb columns around the main image.
      const photos = (p.images && p.images.length) ? p.images : [];
      const mainPhoto = photos[0] || '';
      const thumbLabels = ['Front View', 'Detail — Stitch Close-up', 'Styled on Wall', 'Back & Packaging'];
      const thumbsLeft = document.querySelector('.pd-thumbs-left');
      const thumbsRight = document.querySelector('.pd-thumbs-right');
      if (thumbsLeft && thumbsRight) {
        const thumbHtml = (label, i) => `
          <div class="pd-thumb${i === 0 ? ' active' : ''}" data-label="${label}">
            <div class="img-placeholder ar-square"><img src="${photos[i] || mainPhoto}" alt="${label}" loading="lazy" decoding="async"></div>
          </div>`;
        thumbsLeft.innerHTML = thumbLabels.map(thumbHtml).filter((_, i) => i % 2 === 0).join('');
        thumbsRight.innerHTML = thumbLabels.map(thumbHtml).filter((_, i) => i % 2 === 1).join('');
      }
      const pdMain = document.querySelector('.pd-main');
      if (pdMain) pdMain.innerHTML = `<div class="img-placeholder ar-portrait"><img src="${mainPhoto}" alt="${p.name}" loading="eager" fetchpriority="high" decoding="async"></div>`;

      const catLabel = (p.category || '') + (p.collections && p.collections.length ? ' — ' + p.collections[0] : '');
      const pcCat = document.querySelector('.pd-info > .pc-cat');
      if (pcCat) pcCat.textContent = catLabel;
      const h1 = document.querySelector('.pd-info h1');
      if (h1) h1.textContent = p.name;
      const priceRow = document.querySelector('.pd-price-row');
      if (priceRow) {
        priceRow.innerHTML = `<span>${priceStr}</span>` +
          (p.compareAtPrice ? `<span class="was">₹${Number(p.compareAtPrice).toLocaleString('en-IN')}</span>` : '');
      }
      const desc = document.querySelector('.pd-desc');
      if (desc) desc.textContent = p.description || p.shortDescription || '';

      const sizes = (p.sizes && p.sizes.length) ? p.sizes : ['Medium — 12in'];
      const sizePills = document.querySelector('.size-pills');
      if (sizePills) {
        sizePills.innerHTML = sizes.map((s, i) => `<button type="button" class="size-pill${i === 0 ? ' selected' : ''}">${s}</button>`).join('');
      }
      const sizeOut = document.querySelector('[data-size-value]');
      if (sizeOut) sizeOut.textContent = sizes[0];

      const colors = (p.colors && p.colors.length) ? p.colors : ['gold'];
      const colorOptions = document.querySelector('.color-options');
      if (colorOptions) {
        colorOptions.innerHTML = colors.map((c, i) =>
          `<div class="color-opt${i === 0 ? ' selected' : ''}"><span class="color-swatch" style="--swatch:${SWATCH_HEX[c] || '#ccc'}"></span><span>${COLOR_LABELS[c] || c}</span></div>`
        ).join('');
      }
      const colorOut = document.querySelector('[data-color-value]');
      if (colorOut) colorOut.textContent = COLOR_LABELS[colors[0]] || colors[0];

      const addBtn = document.getElementById('addToCartBtn');
      if (addBtn) { addBtn.setAttribute('data-name', p.name); addBtn.setAttribute('data-price', priceStr); }
      const pdWish = document.getElementById('pdWishBtn');
      if (pdWish) { pdWish.setAttribute('data-name', p.name); pdWish.setAttribute('data-price', priceStr); }
    }

    // Wires up all the interactive bits — run once, after the product's own data (if any)
    // has been rendered into the page, so it always operates on the current product.
    function bindProductInteractions() {
      /* thumbnail swap — clicking a thumb smoothly fades the main image over, and highlights the clicked thumb as active */
      document.querySelectorAll('.pd-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          document.querySelectorAll('.pd-thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          const thumbImg = thumb.querySelector('img');
          const mainImg = document.querySelector('.pd-main img');
          if (mainImg && thumbImg) {
            mainImg.classList.add('is-swapping');
            setTimeout(() => {
              mainImg.setAttribute('src', thumbImg.getAttribute('src'));
              mainImg.setAttribute('alt', thumb.getAttribute('data-label') || mainImg.getAttribute('alt'));
              mainImg.classList.remove('is-swapping');
            }, 220);
          }
        });
      });

      /* size pills */
      let selectedSize = document.querySelector('.size-pill.selected')?.textContent.trim() || '';
      document.querySelectorAll('.size-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('.size-pill').forEach(p => p.classList.remove('selected'));
          pill.classList.add('selected');
          selectedSize = pill.textContent.trim();
          const out = document.querySelector('[data-size-value]');
          if (out) out.textContent = selectedSize;
        });
      });

      /* color options */
      let selectedColor = document.querySelector('.color-opt.selected span')?.textContent.trim() || '';
      document.querySelectorAll('.color-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          selectedColor = opt.querySelector('span').textContent.trim();
          const out = document.querySelector('[data-color-value]');
          if (out) out.textContent = selectedColor;
        });
      });

      /* custom text counter */
      const customText = document.getElementById('customText');
      const charCount = document.getElementById('charCount');
      if (customText && charCount) {
        customText.addEventListener('input', () => {
          const max = 20;
          if (customText.value.length > max) customText.value = customText.value.slice(0, max);
          charCount.textContent = `${customText.value.length} / ${max}`;
        });
      }

      /* quantity stepper */
      const qtyInput = document.querySelector('.qty-stepper input');
      document.querySelectorAll('.qty-stepper button').forEach(btn => {
        btn.addEventListener('click', () => {
          let val = parseInt(qtyInput.value || '1', 10);
          val = btn.classList.contains('qty-minus') ? Math.max(1, val - 1) : val + 1;
          qtyInput.value = val;
        });
      });

      /* accordion */
      document.querySelectorAll('.accordion-item').forEach(item => {
        const head = item.querySelector('.accordion-head');
        const body = item.querySelector('.accordion-body');
        head.addEventListener('click', () => {
          const isOpen = item.classList.contains('open');
          document.querySelectorAll('.accordion-item').forEach(i => {
            i.classList.remove('open');
            i.querySelector('.accordion-body').style.maxHeight = null;
          });
          if (!isOpen) {
            item.classList.add('open');
            body.style.maxHeight = body.scrollHeight + 'px';
          }
        });
      });

      /* add to cart */
      const addBtn = document.getElementById('addToCartBtn');
      if (addBtn) {
        addBtn.addEventListener('click', guardAgainstDoubleFire(() => {
          const name = addBtn.getAttribute('data-name') || 'Talking-Thread Piece';
          const price = addBtn.getAttribute('data-price') || '';
          const mainImg = document.querySelector('.pd-main img');
          Store.addToCart({
            name, price,
            img: (mainImg && mainImg.getAttribute('src')) || '',
            size: selectedSize || 'Medium — 12in Hoop',
            color: selectedColor || 'Antique Gold',
            text: (customText && customText.value.trim()) || '—',
            qty: parseInt(qtyInput ? qtyInput.value : '1', 10)
          });
          showToast('Added to your bag');
        }));
      }

      /* wishlist toggle on product page */
      const pdWish = document.getElementById('pdWishBtn');
      if (pdWish) {
        const name = pdWish.getAttribute('data-name');
        if (Store.isWishlisted(name)) pdWish.classList.add('active');
        pdWish.addEventListener('click', () => {
          const mainImg = document.querySelector('.pd-main img');
          const added = Store.toggleWishlist({ name, price: pdWish.getAttribute('data-price'), img: (mainImg && mainImg.getAttribute('src')) || '' });
          pdWish.classList.toggle('active', added);
          showToast(added ? 'Saved to wishlist' : 'Removed from wishlist');
        });
      }
    }

    // "You May Also Like" — replaced with real related products from the API when
    // available; otherwise the static fallback cards already in the HTML stay put.
    function renderRelated(products) {
      const grid = document.querySelector('.related-products .product-grid');
      if (!grid || !products || !products.length) return;
      grid.innerHTML = products.map(productCardTemplate).join('');
      bindWishToggleButtons(grid);
      bindQuickAddButtons(grid);
    }

    const productKey = new URLSearchParams(window.location.search).get('slug')
      || new URLSearchParams(window.location.search).get('id');

    if (productKey) {
      apiRequest('/products/' + encodeURIComponent(productKey))
        .then(data => {
          renderProductData(data.product);
          bindProductInteractions();
          return apiRequest('/products/' + encodeURIComponent(productKey) + '/related').catch(() => null);
        })
        .then(relData => { if (relData) renderRelated(relData.products); })
        .catch(err => {
          showToast(err.message || 'Could not load that product.');
          bindProductInteractions(); // still let people interact with whatever is on the page
        });
    } else {
      // No product specified in the URL (e.g. someone opened product.html directly) —
      // just wire up interactions on whatever example markup is already in the page.
      bindProductInteractions();
    }
  }

  /* ============================================================
     CART PAGE render
     ============================================================ */
  const cartList = document.getElementById('cartList');
  if (cartList) {
    const render = () => {
      const cart = Store.getCart();
      const emptyState = document.getElementById('cartEmpty');
      const layout = document.getElementById('cartLayout');
      if (!cart.length) {
        if (layout) layout.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }
      if (layout) layout.style.display = 'grid';
      if (emptyState) emptyState.style.display = 'none';

      cartList.innerHTML = cart.map(item => `
        <div class="cart-item" data-id="${item.id}">
          <div class="img-placeholder ar-square">
            ${item.img
              ? `<img src="${item.img}" alt="${item.name}">`
              : `<div class="ph-inner"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span class="ph-label">${item.name}</span></div>`}
          </div>
          <div>
            <div class="ci-title">${item.name}</div>
            <div class="ci-meta">
              <div><b>Size:</b> ${item.size}</div>
              <div><b>Thread:</b> ${item.color}</div>
              <div><b>Embroidered text:</b> ${item.text}</div>
            </div>
            <div class="qty-stepper qty-stepper--sm">
              <button class="qty-minus" data-act="dec">−</button>
              <input type="text" value="${item.qty || 1}" readonly>
              <button class="qty-plus" data-act="inc">+</button>
            </div>
          </div>
          <div class="ci-right">
            <div class="ci-price">${item.price}</div>
            <button class="ci-remove" data-act="remove">Remove</button>
          </div>
        </div>
      `).join('');

      cartList.querySelectorAll('.cart-item').forEach(el => {
        const id = el.getAttribute('data-id');
        const item = cart.find(i => i.id === id);
        el.querySelector('[data-act="inc"]').addEventListener('click', guardAgainstDoubleFire(() => Store.updateCartQty(id, (item.qty || 1) + 1)));
        el.querySelector('[data-act="dec"]').addEventListener('click', guardAgainstDoubleFire(() => Store.updateCartQty(id, (item.qty || 1) - 1)));
        el.querySelector('[data-act="remove"]').addEventListener('click', guardAgainstDoubleFire(() => { Store.removeFromCart(id); showToast('Removed from bag'); }));
        window.addEventListener('storage', () => {});
      });

      /* subtotal (best-effort numeric parse) */
      const subtotalEl = document.getElementById('cartSubtotal');
      const totalEl = document.getElementById('cartTotal');
      const countEl = document.getElementById('cartItemCount');
      let subtotal = 0;
      cart.forEach(i => {
        const n = parseFloat(String(i.price).replace(/[^0-9.]/g, '')) || 0;
        subtotal += n * (i.qty || 1);
      });
      if (subtotalEl) subtotalEl.textContent = '₹' + subtotal.toLocaleString('en-IN');
      if (totalEl) totalEl.textContent = '₹' + subtotal.toLocaleString('en-IN');
      if (countEl) countEl.textContent = cart.reduce((s, i) => s + (i.qty || 1), 0);
    };

    /* re-render whenever Store changes via wrapping setCart */
    const origSetCart = Store.setCart;
    Store.setCart = function (c) { origSetCart(c); render(); };
    render();

    /* ---------- Checkout modal: shipping address + payment method ---------- */
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutModal = document.getElementById('checkoutModal');
    const checkoutForm = document.getElementById('checkoutForm');
    const checkoutError = document.getElementById('checkoutError');
    const checkoutModalClose = document.getElementById('checkoutModalClose');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const orderConfirmation = document.getElementById('orderConfirmation');
    const ocSummary = document.getElementById('ocSummary');
    const ocDetails = document.getElementById('ocDetails');
    let lastFocusedEl = null;

    function showCheckoutError(message) {
      if (!checkoutError) return;
      checkoutError.textContent = message;
      checkoutError.classList.remove('is-hidden');
    }
    function hideCheckoutError() {
      if (!checkoutError) return;
      checkoutError.classList.add('is-hidden');
      checkoutError.textContent = '';
    }

    function openCheckoutModal() {
      if (!checkoutModal) return;
      lastFocusedEl = document.activeElement;
      hideCheckoutError();
      checkoutModal.classList.remove('is-hidden');
      checkoutModal.setAttribute('aria-hidden', 'false');
      // Hide the floating chat widget while checkout is open — it's appended to <body>
      // outside #page's stacking context, so it would otherwise render on top of and
      // block clicks on the delivery-location map/search/locate controls.
      document.body.classList.add('checkout-open');
      const firstField = document.getElementById('co-name');
      if (firstField) firstField.focus();
      document.addEventListener('keydown', onCheckoutKeydown);
    }
    function closeCheckoutModal() {
      if (!checkoutModal) return;
      checkoutModal.classList.add('is-hidden');
      checkoutModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('checkout-open');
      document.removeEventListener('keydown', onCheckoutKeydown);
      if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();
    }
    function onCheckoutKeydown(e) {
      if (e.key === 'Escape') closeCheckoutModal();
    }

    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (!Store.getCart().length) return;
        if (!Auth.isLoggedIn()) {
          showToast('Please sign in to complete your order.');
          setTimeout(() => { window.location.href = 'login.html'; }, 1100);
          return;
        }
        openCheckoutModal();
      });
    }
    if (checkoutModalClose) checkoutModalClose.addEventListener('click', closeCheckoutModal);
    if (checkoutModal) {
      checkoutModal.addEventListener('click', (e) => { if (e.target === checkoutModal) closeCheckoutModal(); });
    }

    /* Show the Razorpay note only when that method is selected. */
    const paymentRadios = checkoutForm ? checkoutForm.querySelectorAll('input[name="paymentMethod"]') : [];
    function syncPaymentFields() {
      const selected = checkoutForm.querySelector('input[name="paymentMethod"]:checked');
      const method = selected ? selected.value : 'cod';
      const pfRazorpay = document.getElementById('pf-razorpay-note');
      if (pfRazorpay) pfRazorpay.style.display = method === 'razorpay' ? 'block' : 'none';
    }
    paymentRadios.forEach((r) => r.addEventListener('change', syncPaymentFields));
    if (checkoutForm) syncPaymentFields();

    function escapeHtml(str) {
      return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    function renderOrderConfirmation(message, order) {
      Store.setCart([]);
      closeCheckoutModal();

      const layout = document.getElementById('cartLayout');
      const emptyState = document.getElementById('cartEmpty');
      if (layout) layout.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      if (orderConfirmation) {
        orderConfirmation.classList.remove('is-hidden');
        orderConfirmation.style.display = 'block';
        if (ocSummary) ocSummary.textContent = message || `Order ${order.orderNumber} placed successfully.`;
        if (ocDetails) {
          const pinnedAddress = order.shippingAddress && order.shippingAddress.formattedAddress;
          ocDetails.innerHTML = `
            <div class="summary-row"><span>Order Number</span><span>${order.orderNumber}</span></div>
            <div class="summary-row"><span>Payment Method</span><span>${(order.paymentMethod || 'cod').toUpperCase()}</span></div>
            <div class="summary-row total"><span>Total</span><span>&#8377;${Number(order.total || 0).toLocaleString('en-IN')}</span></div>
            ${pinnedAddress ? `<div class="summary-row"><span>Delivering To</span><span>${escapeHtml(pinnedAddress)}</span></div>` : ''}
          `;
        }
      }
      showToast('Your order has been placed successfully!');
      checkoutForm.reset();
    }

    // Opens Razorpay's own Checkout widget (loaded via checkout.razorpay.com/v1/checkout.js
    // in cart.html) for the order the server just created, then verifies the result with
    // the backend before treating anything as paid.
    function openRazorpayCheckout(paymentInit, shippingAddress) {
      if (typeof Razorpay === 'undefined') {
        showCheckoutError('Payment could not start — please refresh the page and try again.');
        placeOrderBtn.textContent = 'Place Order';
        placeOrderBtn.disabled = false;
        return;
      }

      const user = Auth.getUser();
      const rzp = new Razorpay({
        key: paymentInit.keyId,
        amount: paymentInit.amount,
        currency: paymentInit.currency,
        name: 'Talking-Thread',
        description: `Order ${paymentInit.orderNumber}`,
        order_id: paymentInit.razorpayOrderId,
        prefill: {
          name: shippingAddress.fullName,
          email: user && user.email ? user.email : undefined,
          contact: shippingAddress.phone
        },
        theme: { color: '#8B2E3A' },
        handler: async function onSuccess(response) {
          placeOrderBtn.textContent = 'Verifying payment…';
          try {
            const verifyData = await apiRequest('/payments/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify({
                orderId: paymentInit.orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              })
            });
            renderOrderConfirmation(verifyData.message, verifyData.order);
          } catch (err) {
            showCheckoutError(err.message || 'We received your payment but could not verify it — please contact us with your order number before retrying.');
          } finally {
            placeOrderBtn.textContent = 'Place Order';
            placeOrderBtn.disabled = false;
          }
        },
        modal: {
          // Fires when the customer closes the widget without paying (or it errors out) —
          // mark the attempt as failed so it doesn't sit as "pending" forever, and let them try again.
          ondismiss: function onDismiss() {
            apiRequest('/payments/razorpay/failed', {
              method: 'POST',
              body: JSON.stringify({ orderId: paymentInit.orderId, reason: 'Checkout closed before payment completed' })
            }).catch(() => {});
            placeOrderBtn.textContent = 'Place Order';
            placeOrderBtn.disabled = false;
          }
        }
      });

      rzp.on('payment.failed', function onFailed(response) {
        const reason = response && response.error ? response.error.description : 'Payment failed';
        apiRequest('/payments/razorpay/failed', {
          method: 'POST',
          body: JSON.stringify({ orderId: paymentInit.orderId, reason })
        }).catch(() => {});
        showCheckoutError(reason || 'Payment failed — please try again.');
        placeOrderBtn.textContent = 'Place Order';
        placeOrderBtn.disabled = false;
      });

      rzp.open();
    }

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideCheckoutError();

        if (!checkoutForm.checkValidity()) {
          checkoutForm.reportValidity();
          return;
        }

        const selectedPayment = checkoutForm.querySelector('input[name="paymentMethod"]:checked');
        const paymentMethod = selectedPayment ? selectedPayment.value : 'cod';
        // co-lat / co-lng / co-formatted-address are hidden fields populated by the Leaflet/OSM
        // delivery-location picker (js/delivery-map.js) when the shopper searches, uses their
        // current location, or clicks/drags the pin. They stay empty — and are simply omitted
        // here — if the picker isn't used, so this never blocks checkout on its own.
        const latEl = document.getElementById('co-lat');
        const lngEl = document.getElementById('co-lng');
        const formattedAddressEl = document.getElementById('co-formatted-address');

        const shippingAddress = {
          fullName: document.getElementById('co-name').value.trim(),
          phone: document.getElementById('co-phone').value.trim(),
          line1: document.getElementById('co-line1').value.trim(),
          line2: document.getElementById('co-line2').value.trim(),
          city: document.getElementById('co-city').value.trim(),
          state: document.getElementById('co-state').value.trim(),
          postalCode: document.getElementById('co-postal').value.trim(),
          country: document.getElementById('co-country').value.trim()
        };
        if (latEl && lngEl && latEl.value && lngEl.value) {
          shippingAddress.latitude = parseFloat(latEl.value);
          shippingAddress.longitude = parseFloat(lngEl.value);
        }
        if (formattedAddressEl && formattedAddressEl.value) {
          shippingAddress.formattedAddress = formattedAddressEl.value;
        }
        const notes = document.getElementById('co-notes').value.trim();

        const originalLabel = placeOrderBtn.textContent;
        placeOrderBtn.disabled = true;

        try {
          // ROOT CAUSE FIX: wait for any in-flight qty/add/remove cart sync to actually reach
          // the server before asking it to price the order. Both the COD path (POST /orders)
          // and the Razorpay path (POST /payments/razorpay/order) price strictly from the
          // server-side cart (pricedItemsFromCart), never from what's in localStorage/on
          // screen — so skipping this wait is what let a just-changed quantity (visible and
          // correct in the cart UI) get silently dropped from the order total and My Orders.
          placeOrderBtn.textContent = 'Syncing your cart…';
          try {
            await Store.flushPendingCartSync();
          } catch (syncErr) {
            throw new Error('We could not confirm your latest cart changes with the server. Please check your connection and try again.');
          }

          if (paymentMethod === 'razorpay') {
            placeOrderBtn.textContent = 'Starting payment…';
            const paymentInit = await apiRequest('/payments/razorpay/order', {
              method: 'POST',
              body: JSON.stringify({ shippingAddress, notes })
            });
            // Leave the button disabled/labelled while the Razorpay widget is open;
            // its own handler/ondismiss callbacks above re-enable it.
            placeOrderBtn.textContent = 'Waiting for payment…';
            openRazorpayCheckout(paymentInit, shippingAddress);
            return;
          }

          placeOrderBtn.textContent = 'Placing order…';
          const data = await apiRequest('/orders', {
            method: 'POST',
            body: JSON.stringify({ shippingAddress, paymentMethod, notes })
          });
          renderOrderConfirmation(data.message, data.order);
          placeOrderBtn.textContent = originalLabel;
          placeOrderBtn.disabled = false;
        } catch (err) {
          showCheckoutError(err.message || 'Could not place your order — please try again.');
          placeOrderBtn.textContent = originalLabel;
          placeOrderBtn.disabled = false;
        }
      });
    }
  }

  /* ============================================================
     WISHLIST PAGE render
     ============================================================ */
  const wishGrid = document.getElementById('wishGrid');
  if (wishGrid) {
    const render = () => {
      const wl = Store.getWishlist();
      const emptyState = document.getElementById('wishEmpty');
      if (!wl.length) {
        wishGrid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }
      wishGrid.style.display = 'grid';
      if (emptyState) emptyState.style.display = 'none';
      wishGrid.innerHTML = wl.map((item, idx) => {
        const hasImg = item.img && item.img !== 'undefined' && item.img !== 'null';
        return `
        <div class="product-card" data-idx="${idx}">
          <div class="pc-media">
            <div class="img-placeholder ar-portrait">
              ${hasImg
                ? `<img src="${item.img}" alt="${item.name}">`
                : `<div class="ph-inner"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span class="ph-label">${item.name}</span></div>`}
            </div>
          </div>
          <div class="pc-info">
            <div class="pc-title">${item.name}</div>
            <div class="pc-price">${item.price}</div>
            <div class="wish-actions">
              <button class="btn btn-primary btn-sm" data-act="move">Move to Bag</button>
              <button class="btn btn-ghost btn-sm" data-act="remove">Remove</button>
            </div>
          </div>
        </div>
      `;
      }).join('');
      hydrateStaticProductCardLinks(wishGrid);
      wishGrid.querySelectorAll('.product-card').forEach(el => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        const item = wl[idx];
        el.querySelector('[data-act="remove"]').addEventListener('click', (e) => {
          e.stopPropagation();
          Store.setWishlist(Store.getWishlist().filter((i) => i.id !== item.id));
          if (Auth.isLoggedIn()) apiRequest('/wishlist/' + encodeURIComponent(item.id), { method: 'DELETE', keepalive: true }).catch(() => {});
          render();
          showToast('Removed from wishlist');
        });
        el.querySelector('[data-act="move"]').addEventListener('click', (e) => {
          e.stopPropagation();
          Store.addToCart({ name: item.name, price: item.price, img: item.img || '', size: 'Medium', color: 'Antique Gold', text: '—', qty: 1 });
          Store.setWishlist(Store.getWishlist().filter((i) => i.id !== item.id));
          if (Auth.isLoggedIn()) apiRequest('/wishlist/' + encodeURIComponent(item.id), { method: 'DELETE', keepalive: true }).catch(() => {});
          render();
          showToast('Moved to your bag');
        });
      });
    };
    render();
  }

  /* ============================================================
     MY ORDERS PAGE render
     ============================================================ */
  const ordersList = document.getElementById('ordersList');
  if (ordersList) {
    const ordersEmpty = document.getElementById('ordersEmpty');
    const ordersSignedOut = document.getElementById('ordersSignedOut');
    const CANCELLABLE = ['pending', 'confirmed', 'processing'];

    function formatDate(iso) {
      try {
        return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch (e) { return ''; }
    }

    function orderCardTemplate(order) {
      const status = order.status || 'pending';
      const itemsHtml = (order.items || []).map(i => `
        <div class="order-item-row">
          <div>
            <div class="oi-name">${i.name} <span class="oi-meta">&times; ${i.qty || 1}</span></div>
            <div class="oi-meta">Size: ${i.size || '—'} &middot; Thread: ${i.color || '—'}</div>
          </div>
          <div>${i.price || ''}</div>
        </div>
      `).join('');

      return `<div class="order-card" data-order-id="${order._id}">
        <div class="order-card-head">
          <div>
            <h3>Order ${order.orderNumber}</h3>
            <div class="order-meta">Placed on ${formatDate(order.createdAt)}</div>
          </div>
          <span class="order-status status-${status}">${status}</span>
        </div>
        <div class="order-items">${itemsHtml}</div>
        <div class="order-card-foot">
          <div class="order-total">Total: <b>&#8377;${Number(order.total || 0).toLocaleString('en-IN')}</b></div>
          ${CANCELLABLE.includes(status) ? '<button class="btn btn-ghost btn-sm" data-act="cancel-order">Cancel Order</button>' : ''}
        </div>
      </div>`;
    }

    async function loadOrders() {
      if (!Auth.isLoggedIn()) {
        ordersList.style.display = 'none';
        if (ordersEmpty) ordersEmpty.style.display = 'none';
        if (ordersSignedOut) ordersSignedOut.style.display = 'block';
        return;
      }
      if (ordersSignedOut) ordersSignedOut.style.display = 'none';

      try {
        const data = await apiRequest('/orders');
        const orders = data.orders || [];
        if (!orders.length) {
          ordersList.style.display = 'none';
          if (ordersEmpty) ordersEmpty.style.display = 'block';
          return;
        }
        if (ordersEmpty) ordersEmpty.style.display = 'none';
        ordersList.style.display = 'flex';
        ordersList.innerHTML = orders.map(orderCardTemplate).join('');

        ordersList.querySelectorAll('[data-act="cancel-order"]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const card = btn.closest('.order-card');
            const orderId = card.getAttribute('data-order-id');
            const originalLabel = btn.textContent;
            btn.textContent = 'Cancelling…';
            btn.disabled = true;
            try {
              await apiRequest('/orders/' + encodeURIComponent(orderId) + '/cancel', { method: 'PUT' });
              showToast('Your order has been cancelled.');
              loadOrders();
            } catch (err) {
              showToast(err.message || 'Could not cancel this order — please try again.');
              btn.textContent = originalLabel;
              btn.disabled = false;
            }
          });
        });
      } catch (err) {
        ordersList.style.display = 'none';
        if (ordersEmpty) {
          ordersEmpty.style.display = 'block';
          const h3 = ordersEmpty.querySelector('h3');
          const p = ordersEmpty.querySelector('p');
          if (h3) h3.textContent = 'Could not load your orders';
          if (p) p.textContent = err.message || 'Please try again in a moment.';
        }
      }
    }

    loadOrders();
  }

  /* ============================================================
     FORMS — login / register / contact / newsletter
     Now backed by the real API instead of the old demo no-op.
     ============================================================ */
  function setSubmitting(form, isSubmitting, busyLabel) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (isSubmitting) {
      btn.dataset.originalLabel = btn.textContent;
      btn.textContent = busyLabel || 'Please wait…';
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.originalLabel || btn.textContent;
      btn.disabled = false;
    }
  }

  const loginForm = document.getElementById('li-email') ? document.getElementById('li-email').closest('form') : null;
  if (loginForm) {
    // If already signed in, don't show the login form again — send them home
    if (Auth.isLoggedIn()) {
      showToast("You're already signed in.");
      window.location.href = 'index.html';
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('li-email').value.trim();
      const password = document.getElementById('li-pass').value;
      const rememberCheckbox = loginForm.querySelector('.check-row input[type="checkbox"]');
      const rememberMe = rememberCheckbox ? rememberCheckbox.checked : true;

      if (!email || !password) { showToast('Please enter your email and password.'); return; }

      setSubmitting(loginForm, true, 'Signing in…');
      try {
        await Auth.login(email, password, rememberMe);
        showToast('Signed in — welcome back.');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
      } catch (err) {
        showToast(err.message || 'Sign in failed.');
        setSubmitting(loginForm, false);
      }
    });

    // "Forgot password?" — not a dead link anymore, just honest about what's available right now
    const forgotLink = loginForm.querySelector('.field-row a');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        showToast('Password reset isn\'t available yet — please contact the studio via the Contact page.');
      });
    }
  }

  const registerForm = document.getElementById('re-email') ? document.getElementById('re-email').closest('form') : null;
  if (registerForm) {
    // If already signed in, don't show the register form again — send them home
    if (Auth.isLoggedIn()) {
      showToast("You're already signed in.");
      window.location.href = 'index.html';
    }

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('re-name').value.trim();
      const email = document.getElementById('re-email').value.trim();
      const pass = document.getElementById('re-pass').value;
      const pass2 = document.getElementById('re-pass2').value;
      if (!name || !email || !pass || !pass2) { showToast('Please fill in every field.'); return; }
      if (pass.length < 6) { showToast('Password must be at least 6 characters.'); return; }
      if (pass !== pass2) { showToast('Passwords do not match.'); return; }
      setSubmitting(registerForm, true, 'Creating account…');
      try {
        await Auth.register(name, email, pass, false);
        showToast('Account created — welcome to Talking-Thread.');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
      } catch (err) {
        showToast(err.message || 'Could not create account.');
        setSubmitting(registerForm, false);
      }
    });
  }

  /* ---------- "Continue with Google" (login.html / register.html) ---------- */
  document.querySelectorAll('.social-row button').forEach(btn => {
    if (btn.textContent.trim().toLowerCase() !== 'google') return; // leave the Apple button as-is, not implemented
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/api/auth/google';
    });
  });

  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('c-name').value.trim();
      const email = document.getElementById('c-email').value.trim();
      const subject = document.getElementById('c-subject').value;
      const message = document.getElementById('c-message').value.trim();
      setSubmitting(contactForm, true, 'Sending…');
      try {
        const data = await apiRequest('/contact', { method: 'POST', body: JSON.stringify({ name, email, subject, message }) });
        showToast(data.message || 'Message sent.');
        contactForm.reset();
      } catch (err) {
        showToast(err.message || 'Could not send your message.');
      } finally {
        setSubmitting(contactForm, false);
      }
    });
  }

  // A page can have more than one newsletter form (e.g. the dark "newsletter-band"
  // section AND the compact footer signup), so bind all of them, not just the first.
  const newsletterForms = Array.from(document.querySelectorAll('.newsletter-form'));
  newsletterForms.forEach(newsletterForm => {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector('input[type="email"]').value.trim();
      setSubmitting(newsletterForm, true, 'Subscribing…');
      try {
        const data = await apiRequest('/newsletter', { method: 'POST', body: JSON.stringify({ email }) });
        showToast(data.message || 'Subscribed.');
        newsletterForm.reset();
      } catch (err) {
        showToast(err.message || 'Could not subscribe right now.');
      } finally {
        setSubmitting(newsletterForm, false);
      }
    });
  });

  // Any other demo forms (not one of the ones above) keep the original harmless no-op behaviour
  document.querySelectorAll('[data-demo-form]').forEach(form => {
    if (form === loginForm || form === registerForm || form === contactForm || newsletterForms.includes(form)) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast(form.getAttribute('data-demo-form') || 'Thank you.');
      form.reset();
    });
  });

  /* ---------- Footer: auto-updating copyright year ---------- */
  document.querySelectorAll('#footer-year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  /* ============================================================
     REVIEWS PAGE (reviews.html) — summary, filter/sort, list,
     pagination, and the write-a-review form.
     ============================================================ */
  const reviewsGrid = document.getElementById('reviewsGrid');
  if (reviewsGrid) {
    const rsAverage = document.getElementById('rsAverage');
    const rsAverageStars = document.getElementById('rsAverageStars');
    const rsCount = document.getElementById('rsCount');
    const rsBreakdown = document.getElementById('rsBreakdown');
    const ratingChips = document.getElementById('ratingChips');
    const sortSelect = document.getElementById('reviewsSortSelect');
    const reviewsEmpty = document.getElementById('reviewsEmpty');
    const loadMoreWrap = document.getElementById('reviewsLoadMoreWrap');
    const loadMoreBtn = document.getElementById('reviewsLoadMoreBtn');
    const reviewForm = document.getElementById('reviewForm');
    const reviewsSignedOut = document.getElementById('reviewsSignedOut');
    const productSelect = document.getElementById('rv-product');
    const starInput = document.getElementById('rvStarInput');
    const photoList = document.getElementById('rvPhotoList');
    const addPhotoBtn = document.getElementById('rvAddPhoto');

    const STAR_PATH = 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z';

    function escapeHtml(str) {
      return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    function starsHTML(rating, count = 5) {
      let html = '';
      const rounded = Math.round(rating);
      for (let i = 1; i <= count; i++) {
        html += `<svg viewBox="0 0 24 24" class="${i <= rounded ? 'is-filled' : ''}" aria-hidden="true" focusable="false"><path d="${STAR_PATH}"/></svg>`;
      }
      return html;
    }

    function initials(name) {
      return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }

    function formatDate(iso) {
      try {
        return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch (e) { return ''; }
    }

    let state = { page: 1, limit: 6, rating: '', sort: 'newest', pages: 1 };

    async function loadSummary() {
      try {
        const data = await apiRequest('/reviews/summary');
        rsAverage.textContent = data.count ? data.average.toFixed(1) : '—';
        rsAverageStars.innerHTML = starsHTML(data.average || 0);
        rsCount.textContent = data.count
          ? `Based on ${data.count} review${data.count === 1 ? '' : 's'}`
          : 'No reviews yet — be the first.';
        const total = data.count || 0;
        [5, 4, 3, 2, 1].forEach(star => {
          const c = (data.breakdown && data.breakdown[star]) || 0;
          const pct = total ? Math.round((c / total) * 100) : 0;
          const fill = rsBreakdown.querySelector(`[data-star="${star}"]`);
          const countEl = rsBreakdown.querySelector(`[data-star-count="${star}"]`);
          if (fill) fill.style.width = pct + '%';
          if (countEl) countEl.textContent = c;
        });
      } catch (err) {
        rsCount.textContent = 'Could not load review stats right now.';
      }
    }

    function reviewCardHTML(review) {
      const productName = review.product && review.product.name ? review.product.name : null;
      const photos = Array.isArray(review.photos) ? review.photos.filter(Boolean) : [];
      const safeName = escapeHtml(review.name || 'Customer');
      return `
        <article class="review-card">
          <div class="review-card-head">
            <div class="review-who">
              <div class="review-avatar" aria-hidden="true">${escapeHtml(initials(review.name))}</div>
              <div>
                <div class="review-name-row">
                  <strong>${safeName}</strong>
                  ${review.verifiedPurchase ? '<span class="verified-badge"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 6L9 17l-5-5"/></svg>Verified Purchase</span>' : ''}
                </div>
                <div class="review-date">${formatDate(review.createdAt)}</div>
              </div>
            </div>
            <div class="stars" aria-label="${review.rating} out of 5 stars">${starsHTML(review.rating)}</div>
          </div>
          ${productName ? `<div class="review-product-tag">Reviewed: ${escapeHtml(productName)}</div>` : ''}
          <p class="review-comment"></p>
          ${photos.length ? `<div class="review-photos">${photos.slice(0, 3).map(p => `<a href="${escapeHtml(p)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(p)}" alt="Photo from ${safeName}'s review" loading="lazy"></a>`).join('')}</div>` : ''}
        </article>`;
    }

    let reviewsRequestId = 0;
    async function loadReviews(append) {
      const requestId = ++reviewsRequestId;
      try {
        const params = new URLSearchParams();
        if (state.rating) params.set('rating', state.rating);
        params.set('sort', state.sort);
        params.set('page', state.page);
        params.set('limit', state.limit);
        const data = await apiRequest('/reviews?' + params.toString());
        if (requestId !== reviewsRequestId) return; // a newer request has since started — discard this stale response
        const reviews = data.reviews || [];
        state.pages = data.pages || 1;

        if (!append) reviewsGrid.innerHTML = '';

        if (!append && !reviews.length) {
          reviewsEmpty.style.display = 'block';
          reviewsGrid.style.display = 'none';
          loadMoreWrap.style.display = 'none';
          return;
        }

        reviewsEmpty.style.display = 'none';
        reviewsGrid.style.display = 'grid';

        reviews.forEach(review => {
          const wrap = document.createElement('div');
          wrap.innerHTML = reviewCardHTML(review);
          const card = wrap.firstElementChild;
          // set the comment as text (not innerHTML) to avoid any markup injection
          card.querySelector('.review-comment').textContent = review.comment || '';
          reviewsGrid.appendChild(card);
        });

        loadMoreWrap.style.display = state.page < state.pages ? 'flex' : 'none';
      } catch (err) {
        showToast(err.message || 'Could not load reviews right now.');
      }
    }

    ratingChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.rating-chip');
      if (!chip) return;
      ratingChips.querySelectorAll('.rating-chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.rating = chip.getAttribute('data-rating') || '';
      state.page = 1;
      loadReviews(false);
    });

    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      state.page = 1;
      loadReviews(false);
    });

    loadMoreBtn.addEventListener('click', () => {
      state.page += 1;
      loadReviews(true);
    });

    loadSummary();
    loadReviews(false);

    /* ---------- Write-a-review form: product dropdown ---------- */
    async function loadProductOptions() {
      try {
        const data = await apiRequest('/products?limit=100&sort=featured');
        const products = data.products || [];
        productSelect.innerHTML = '<option value="">Select a product&hellip;</option>' +
          products.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
      } catch (err) {
        productSelect.innerHTML = '<option value="">Could not load products</option>';
      }
    }

    /* ---------- Interactive star picker ---------- */
    let selectedRating = 0;
    starInput.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      selectedRating = Number(btn.getAttribute('data-value'));
      starInput.querySelectorAll('button').forEach(b => {
        b.classList.toggle('is-selected', Number(b.getAttribute('data-value')) <= selectedRating);
      });
    });

    /* ---------- Optional photo URL rows (max 3) ---------- */
    function bindPhotoRowRemove(row) {
      row.querySelector('[data-remove-photo]').addEventListener('click', () => {
        if (photoList.children.length > 1) row.remove();
        else row.querySelector('input').value = '';
      });
    }
    photoList.querySelectorAll('.photo-url-row').forEach(bindPhotoRowRemove);

    addPhotoBtn.addEventListener('click', () => {
      if (photoList.children.length >= 3) {
        showToast('You can add up to 3 photos.');
        return;
      }
      const row = document.createElement('div');
      row.className = 'photo-url-row';
      row.innerHTML = '<input type="url" placeholder="https://example.com/your-photo.jpg" data-photo-url><button type="button" aria-label="Remove photo link" data-remove-photo>&times;</button>';
      photoList.appendChild(row);
      bindPhotoRowRemove(row);
    });

    /* ---------- Show the form only when signed in ---------- */
    function refreshFormVisibility() {
      if (Auth.isLoggedIn()) {
        reviewForm.style.display = 'block';
        reviewsSignedOut.style.display = 'none';
        loadProductOptions();
      } else {
        reviewForm.style.display = 'none';
        reviewsSignedOut.style.display = 'block';
      }
    }
    refreshFormVisibility();

    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const productId = productSelect.value;
      const comment = document.getElementById('rv-comment').value.trim();
      const photos = Array.from(photoList.querySelectorAll('[data-photo-url]'))
        .map(i => i.value.trim())
        .filter(Boolean);

      if (!productId) { showToast('Please choose which piece you are reviewing.'); return; }
      if (!selectedRating) { showToast('Please select a star rating.'); return; }
      if (!comment) { showToast('Please write your review.'); return; }

      setSubmitting(reviewForm, true, 'Submitting…');
      try {
        const data = await apiRequest('/reviews', {
          method: 'POST',
          body: JSON.stringify({ productId, rating: selectedRating, comment, photos })
        });
        showToast('Thank you — your review is live.');
        reviewForm.reset();
        selectedRating = 0;
        starInput.querySelectorAll('button').forEach(b => b.classList.remove('is-selected'));
        while (photoList.children.length > 1) photoList.lastElementChild.remove();
        photoList.querySelector('input').value = '';

        // Show the new review immediately at the top of the list, and refresh the stats.
        if (data.review) {
          const wrap = document.createElement('div');
          wrap.innerHTML = reviewCardHTML(data.review);
          const card = wrap.firstElementChild;
          card.querySelector('.review-comment').textContent = data.review.comment || '';
          reviewsEmpty.style.display = 'none';
          reviewsGrid.style.display = 'grid';
          reviewsGrid.insertBefore(card, reviewsGrid.firstChild);
        }
        loadSummary();
      } catch (err) {
        showToast(err.message || 'Could not submit your review right now.');
      } finally {
        setSubmitting(reviewForm, false);
      }
    });

    /* keep the form's signed-in state correct if this fires before the account-icon logic above */
    window.addEventListener('storage', (e) => {
      if (e.key === 'tt_user') refreshFormVisibility();
    });
  }

  /* ---------- Google OAuth return trip (index.html?auth=google_success / login.html?auth=google_error) ---------- */
  (async function handleGoogleAuthRedirect() {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');
    if (!authResult) return;

    if (authResult === 'google_success') {
      try {
        // The server already set the session cookie via the redirect — just fetch who we are
        const data = await apiRequest('/auth/me');
        Auth.setUser(data.user);
        await Auth.mergeGuestDataIntoAccount();
        showToast(`Signed in with Google — welcome${data.user.name ? ', ' + data.user.name.split(' ')[0] : ''}.`);
      } catch (err) {
        showToast('Signed in with Google, but could not load your account details.');
      }
    } else if (authResult === 'google_error') {
      showToast(params.get('message') || 'Google sign-in failed. Please try again.');
    }

    // Clean the ?auth=... params out of the URL so a refresh doesn't re-trigger this
    params.delete('auth');
    params.delete('message');
    const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, document.title, cleanUrl);
  })();

  /* ---------- "My Orders" nav link — injected only when signed in, so every page's
     static markup stays exactly as it was for guests ---------- */
  (function injectMyOrdersLink() {
    if (!Auth.isLoggedIn()) return;

    const headerIcons = document.querySelector('.header-icons');
    if (headerIcons && !headerIcons.querySelector('a[href="my-orders.html"]')) {
      const link = document.createElement('a');
      link.href = 'my-orders.html';
      link.className = 'icon-btn';
      link.setAttribute('aria-label', 'My Orders');
      link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h12v18l-2.5-1.6L13 21l-1-1.6-1 1.6-2.5-1.6L6 21V3z"/><path d="M9 8h6M9 12h4"/></svg>';
      const cartIcon = headerIcons.querySelector('a[href="cart.html"]');
      if (cartIcon) headerIcons.insertBefore(link, cartIcon);
      else headerIcons.appendChild(link);
    }

    const mobilePanel = document.querySelector('.mobile-panel');
    if (mobilePanel && !mobilePanel.querySelector('a[href="my-orders.html"]')) {
      const link = document.createElement('a');
      link.href = 'my-orders.html';
      link.textContent = 'My Orders';
      const accountLink = mobilePanel.querySelector('a[href="login.html"]');
      if (accountLink) mobilePanel.insertBefore(link, accountLink);
      else mobilePanel.appendChild(link);
    }
  })();

  /* ---------- Account icon: sign out if already signed in (no markup changes) ---------- */
  if (Auth.isLoggedIn()) {
    document.querySelectorAll('a[href="login.html"]').forEach(link => {
      link.setAttribute('title', `Signed in as ${Auth.getUser().name} — click to sign out`);
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        await Auth.logout();
        showToast('Signed out.');
        window.location.href = 'index.html';
      });
    });
  }

  /* ---------- Keep local cart/wishlist in sync with the server across page loads ---------- */
  if (Auth.isLoggedIn()) {
    Auth.pullServerState();
  }

  /* header background on scroll for subtle depth */
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 8 ? '0 6px 24px -18px rgba(33,28,21,0.4)' : 'none';
    });
  }
});