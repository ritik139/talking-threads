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
    const WHATSAPP_PHONE = '919024655202'; // <-- TODO: put the real WhatsApp number here
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
      // Must match the CSS breakpoint that hides the hamburger and shows
      // .nav-links-row again (max-width: 1024px in style.css). Using a
      // different threshold here left a 769–1024px gap where the panel
      // force-closed while the header was still in hamburger mode.
      if (window.innerWidth > 1024 && menuToggle.classList.contains('open')) closeMenu();
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

    // Fail-safe: .reveal elements start at opacity:0 and only reach opacity:1
    // via the 'in' class above. If the observer never fires for an element
    // (very long/short pages, an element that never crosses the 0.12
    // threshold, a bfcache restore, or any other edge case) that content
    // would stay permanently invisible with no way for the user to recover
    // it. After a generous delay, force-reveal anything still hidden so a
    // missed observation degrades to "no animation" instead of "no content".
    window.setTimeout(() => {
      revealEls.forEach(el => el.classList.add('in'));
    }, 2500);
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

    // Not a real fetch option — pulled out here so it never gets sent to fetch() itself.
    const suppressAuthClear = options.suppressAuthClear;
    const fetchOptions = { ...options };
    delete fetchOptions.suppressAuthClear;

    let res;
    try {
      res = await fetch(API_BASE + path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...fetchOptions,
        signal: controller.signal
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') {
        throw new Error('The server took too long to respond. Please check your connection and try again.');
      }
      // fetch() only throws for network-level failures — the API server is unreachable
      throw new Error('Could not reach the server. Please make sure the backend is running and try again.');
    } finally {
      clearTimeout(timeoutId);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      // ROOT CAUSE FIX (stale "signed in" state after the server session actually expired):
      // tt_user in localStorage has no expiry of its own — it's just a cached mirror of
      // whoever last successfully signed in, written once and never re-checked against the
      // real session. The actual session lives in an httpOnly JWT cookie that DOES expire
      // (1 day if "Remember me" was off, 30 days otherwise) or can be invalidated server-side
      // (account disabled, etc.) — see backend/middleware/auth.js. Previously nothing ever
      // reconciled the two: once the cookie/JWT went stale, every protected endpoint started
      // returning 401, but Auth.isLoggedIn() (which only reads tt_user) kept reporting "signed
      // in" indefinitely. That let the header keep showing "My Orders", requireLogin() kept
      // waving guests-who-were-actually-logged-out straight through to Checkout, and the
      // eventual /cart or /orders call just failed with a generic "Request failed (401)"
      // instead of the real "please sign in again."
      //
      // Fix: the moment the server tells us a request was unauthorized WHILE we believed we
      // were signed in, drop the local user record so every subsequent Auth.isLoggedIn()
      // check in this page (and the next one) reflects reality instead of a stale cache.
      // Gated on Auth.getUser() so this never fires for an ordinary wrong-password 401 on
      // the login form itself (tt_user is never set at that point — the login/register pages
      // already redirect away before showing the form if someone is signed in).
      //
      // SECOND FIX (this change) — a 401 on the very first request(s) right after a login/
      // register/Google sign-in succeeded is a race, not a real invalidation: the server
      // just handed back a fresh, valid session cookie a moment ago in the login/register
      // response itself. If the browser's cookie write and this immediate follow-up request
      // (the guest-cart merge, or the post-login cart/wishlist pull) happen to race, or the
      // very first request after sign-in transiently 401s for any other reason, the old logic
      // above would silently wipe the tt_user we *just* set — the login toast says "welcome
      // back" but the header immediately loses the account/My Orders state with no visible
      // error. Callers doing that specific post-auth sync pass `suppressAuthClear: true` so a
      // transient failure there degrades to "local state didn't sync yet" instead of
      // "log the person back out". Normal, later page-load syncs are unaffected and still
      // self-correct a truly stale session as before.
      if (res.status === 401 && Auth.getUser() && !suppressAuthClear) {
        Auth.clearUser();
      }
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

    // ROOT CAUSE FIX (intermittent "guest can open Checkout" bug):
    //
    // Previously, the "must be signed in" check only lived at individual call sites —
    // the checkoutBtn click handler had one, but Store.addToCart() and the various
    // "Add to Cart"/"Quick Add"/"Move to Bag" buttons that call it had none at all, and
    // openCheckoutModal() itself had none either (it trusted whoever called it to have
    // already checked). That meant the gate only existed where someone remembered to
    // write it, which is exactly the kind of thing that's consistent in some flows and
    // silently missing in others — e.g. a guest could always add to cart (no gate there),
    // then a leftover cart from a previous signed-in session on the same device, or any
    // future code path that calls openCheckoutModal() directly, could still open the
    // modal because the modal itself never checked.
    //
    // Fix: put the check in exactly one place — this helper — and call it from the two
    // places that actually need to enforce it (Store.addToCart and openCheckoutModal
    // itself, not just its button handler), so the gate exists structurally at the
    // point of action rather than being something every call site has to remember.
    requireLogin(message) {
      if (Auth.isLoggedIn()) return true;
      showToast(message || 'Please sign in to continue.');
      // Remember exactly where the user was (e.g. product.html?id=... they were
      // trying to add to cart from) so that once they finish signing in we can
      // send them right back here instead of dumping them on the homepage.
      Auth.saveRedirect();
      setTimeout(() => { window.location.href = 'login.html'; }, 700);
      return false;
    },

    // ---- post-login redirect helpers ----
    // Stored in sessionStorage (not localStorage) so it's scoped to this tab/visit
    // and never lingers around to hijack an unrelated future sign-in.
    REDIRECT_KEY: 'tt_post_login_redirect',
    saveRedirect(url) {
      const target = url || (window.location.pathname + window.location.search);
      // Never save the auth pages themselves as a "redirect back to" target.
      if (/\/?(login|register)\.html$/i.test(target.split('?')[0])) return;
      try { sessionStorage.setItem(Auth.REDIRECT_KEY, target); } catch (e) { /* ignore */ }
    },
    consumeRedirect() {
      try {
        const target = sessionStorage.getItem(Auth.REDIRECT_KEY);
        sessionStorage.removeItem(Auth.REDIRECT_KEY);
        return target || null;
      } catch (e) { return null; }
    },

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
      // Also drop any local cart/wishlist on sign-out. Without this, a cart built up while
      // signed in stays in localStorage after logout — so on a shared/public device the
      // very next (now signed-out) visitor would see items already sitting in their bag,
      // which is the "leftover cart" route to a guest reaching the Checkout modal.
      Store.setCart([]);
      Store.setWishlist([]);
    },

    // Pushes whatever is currently in the guest (localStorage) cart/wishlist up to the
    // account that was just signed into, then pulls back the merged, canonical version.
    // Always called within moments of a successful login/register/Google sign-in, so every
    // request here passes suppressAuthClear — see the note in apiRequest for why a 401 this
    // soon after a fresh sign-in must not be treated as "actually logged out".
    async mergeGuestDataIntoAccount() {
      const guestCart = Store.getCart();
      const guestWishlist = Store.getWishlist();
      try {
        if (guestCart.length) await apiRequest('/cart/merge', { method: 'POST', body: JSON.stringify({ items: guestCart }), suppressAuthClear: true });
        if (guestWishlist.length) await apiRequest('/wishlist/merge', { method: 'POST', body: JSON.stringify({ items: guestWishlist }), suppressAuthClear: true });
      } catch (e) { /* best-effort merge */ }
      await Auth.pullServerState(true, true);
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
    async pullServerState(forceOverwrite = false, suppressAuthClear = false) {
      try {
        const [cartData, wishlistData] = await Promise.all([
          apiRequest('/cart', { suppressAuthClear }),
          apiRequest('/wishlist', { suppressAuthClear })
        ]);
        if (forceOverwrite || Store.getCart().length === 0) Store.setCart(cartData.cart || []);
        if (forceOverwrite || Store.getWishlist().length === 0) Store.setWishlist(wishlistData.wishlist || []);

        // ROOT-CAUSE CLEANUP: a line with no `product` predates the checkout
        // price-verification fix (orderController.pricedItemsFromCart requires every line
        // to be linked to a real Product, since an unlinked line's price can't be trusted —
        // see that file for the full explanation). Such a line can never be priced, so it
        // would otherwise sit in the cart indefinitely and only surface as a "could not be
        // verified" error deep in checkout — one item at a time, since checkout stops at
        // the first bad line it finds.
        //
        // This runs unconditionally (not only on the branch above that overwrites from the
        // server) and checks whatever cart is currently active — because the common case
        // is exactly the opposite: someone already signed in, with a non-empty local cart
        // carried over from before this fix shipped, whose plain page reloads always take
        // the "local cart is non-empty, don't touch it" branch above and would otherwise
        // never get cleaned. Checking Store.getCart() here (its state *after* the decision
        // above) covers both cases with one pass.
        const dropped = Store.getCart().filter((i) => !i.product);
        if (dropped.length) {
          Store.setCart(Store.getCart().filter((i) => i.product));
          // Best-effort cleanup so these can't reappear on the next sync — same
          // fire-and-forget pattern as Store.removeFromCart (DELETE is idempotent, so a
          // dropped/slow request here just means the line lingers server-side until the
          // next successful cleanup, with no other effect).
          dropped.forEach((i) => {
            apiRequest('/cart/' + encodeURIComponent(i.id), { method: 'DELETE', keepalive: true }).catch(() => {});
          });
          showToast(
            dropped.length === 1
              ? `"${dropped[0].name || 'One item'}" was removed from your bag — please add it again.`
              : `${dropped.length} items were removed from your bag — please add them again.`
          );
        }
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

  const Store = {
    getCart() {
      try {
        const parsed = JSON.parse(localStorage.getItem('tt_cart') || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        // Corrupted/legacy localStorage value — reset to empty rather than crash every page.
        return [];
      }
    },
    setCart(c) { localStorage.setItem('tt_cart', JSON.stringify(c)); Store.refreshCounts(); },
    getWishlist() {
      let wl;
      try {
        const parsed = JSON.parse(localStorage.getItem('tt_wishlist') || '[]');
        wl = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        wl = [];
      }
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
      // Must be signed in before anything else happens — no localStorage write, no
      // server call, no "Added to your bag" toast. See Auth.requireLogin() above for why
      // this lives here rather than at each button's click handler.
      if (!Auth.requireLogin('Please sign in to add items to your bag.')) return false;

      // Generate the id once and use it for BOTH the local line item and the server
      // request. Previously the local id was created here but never sent to the server
      // (the POST body was built from the original `item`, without an id), so the
      // backend minted its own unrelated id for the same cart line. localStorage and
      // the DB then disagreed on that line's id from the moment it was created, which
      // meant every later PATCH /cart/:itemId from updateCartQty() (sent with the LOCAL
      // id) silently 404'd against the server — the qty looked right in the cart page
      // (localStorage) but was never actually updated in the DB, so it showed up as a
      // "cart changed since last confirmed with server" mismatch at checkout. Sending
      // the same id to the server and having it reuse that id keeps both sides in sync.
      const newItem = Object.assign({ id: genId('ci') }, item);
      const cart = Store.getCart();
      cart.push(newItem);
      Store.setCart(cart);
      // Auth.requireLogin() above already guarantees we're signed in here, so the server
      // sync always fires — there is no "guest cart, sync later" path anymore.
      // keepalive: true lets this request finish in the background even if the user
      // immediately navigates away (e.g. clicking the cart icon right after adding).
      // Without it, the browser cancels in-flight fetches on page unload — so the
      // item never actually reaches the server, and the very next page load's
      // Auth.pullServerState() (which GETs the server cart and overwrites localStorage
      // with it) wipes out the item that had just been added. This was the root cause
      // of "item added, but Cart page shows empty".
      apiRequest('/cart', { method: 'POST', body: JSON.stringify(newItem), keepalive: true }).catch(() => {});
      return true;
    },
    removeFromCart(id) {
      Store.setCart(Store.getCart().filter(i => i.id !== id));
      if (Auth.isLoggedIn()) {
        // Same navigation-cancellation risk as addToCart above.
        apiRequest('/cart/' + encodeURIComponent(id), { method: 'DELETE', keepalive: true }).catch(() => {});
        // DELETE is idempotent from the server's point of view — if `id` doesn't match
        // anything there (e.g. this is a legacy line from before the id fix below), the
        // desired end state ("this line is gone") already holds, so no self-heal is
        // needed here the way it is for updateCartQty, which needs an id to apply a
        // delta *to*.
      }
    },
    updateCartQty(id, qty) {
      const before = Store.getCart().find(i => i.id === id);
      const newQty = Math.max(1, qty);
      const cart = Store.getCart().map(i => i.id === id ? Object.assign({}, i, { qty: newQty }) : i);
      Store.setCart(cart);
      if (Auth.isLoggedIn() && before) {
        // Sent as a relative delta (not the absolute target qty) so the server can apply it
        // with a single atomic, order-independent $inc — two rapid stepper clicks racing
        // over a real network can then never clobber each other regardless of which one's
        // round trip finishes first. (Root cause of a production-only cart/order total
        // mismatch: the old absolute-qty PATCH let an out-of-order write silently revert a
        // quantity change, and that reverted qty then got frozen into the order total at
        // checkout. See cartController.updateCartItem for the server-side fix.)
        const delta = newQty - (before.qty || 1);
        if (delta !== 0) Store._syncQtyDelta(id, delta, before);
      }
    },
    // Sends a qty delta for cart line `id` to the server. Carts created BEFORE the
    // add-to-cart id fix above have a line whose server-side id was independently
    // generated and never matches the local id, so this PATCH 404s ("Cart item not
    // found."). Rather than let that keep failing silently forever (the original bug),
    // fall back to identifying the line on the server by its product signature, adopt
    // the server's id locally so every future update targets it correctly, and retry
    // the same delta once. This never runs on carts created after the fix, since those
    // ids already match and the first PATCH succeeds.
    async _syncQtyDelta(id, delta, item) {
      try {
        await apiRequest('/cart/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ delta }), keepalive: true });
      } catch (err) {
        if (!/not found/i.test(err && err.message || '')) return; // some other failure — don't guess
        try {
          const data = await apiRequest('/cart');
          const serverCart = (data && data.cart) || [];
          const match = serverCart.find(si => si.name === item.name && si.size === item.size && si.color === item.color && si.text === item.text);
          if (!match) return; // no corresponding line server-side to reconcile against
          const cartNow = Store.getCart();
          const idx = cartNow.findIndex(i => i.id === id);
          if (idx !== -1) {
            cartNow[idx] = Object.assign({}, cartNow[idx], { id: match.id });
            Store.setCart(cartNow);
          }
          await apiRequest('/cart/' + encodeURIComponent(match.id), { method: 'PATCH', body: JSON.stringify({ delta }), keepalive: true });
        } catch (e2) { /* best-effort reconciliation; localStorage still reflects the intended qty */ }
      }
    },

    // ROOT CAUSE FIX ("Checkout shows bag is empty" even though the Cart page has items):
    //
    // addToCart()/removeFromCart()/updateCartQty() all sync to the server with a
    // fire-and-forget POST/PATCH/DELETE (`.catch(() => {})`, `keepalive: true`) so the UI
    // never blocks on the network. That's fine for the *cart page*, which only ever reads
    // from localStorage. But order creation (orderController.pricedItemsFromCart) re-prices
    // and validates against the CART DOCUMENT IN THE DATABASE ONLY — on purpose, since the
    // client-supplied price/qty can't be trusted at checkout. If any one of those
    // best-effort background calls silently failed (a dropped request, a slow network, a
    // brief server hiccup, an expired session at the moment it fired) localStorage and the
    // DB permanently disagree from that point on: the Cart page (reading localStorage) keeps
    // showing the item, the header badge keeps counting it, "Proceed to Checkout" opens
    // normally (it only checks localStorage) — and then submitting the order 400s with
    // "Your bag is empty" because the DB cart never actually received it. Nothing in the
    // old flow ever re-checked or repaired that drift, so the person could fill in their
    // entire address and only find out at the very last step.
    //
    // Fix: instead of trusting whatever background syncs happened to succeed, force the
    // server's cart to exactly match localStorage — the thing the person is actually
    // looking at — at the one moment it matters most: right before checkout opens (see the
    // checkoutBtn handler below, and again right before order submission as a second
    // safety net). PUT /api/cart (replaceCart) does a full, idempotent overwrite, so this
    // is correct however the drift happened, not just for the specific failure modes above.
    async ensureServerSynced() {
      if (!Auth.isLoggedIn()) return true; // guest checkout path handles its own thing (login redirect)
      try {
        await apiRequest('/cart', { method: 'PUT', body: JSON.stringify({ items: Store.getCart() }) });
        return true;
      } catch (e) {
        return false;
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

  // Keep the header's cart/wishlist badge counts correct across tabs. Same-tab mutations
  // already call Store.refreshCounts() directly (see setCart/setWishlist above); this
  // covers the other case — tt_cart/tt_wishlist changing because a DIFFERENT tab (or
  // window) on this browser just added/removed/checked-out — which the 'storage' event
  // is exactly designed to report and nothing here was previously listening for.
  window.addEventListener('storage', (e) => {
    if (e.key === 'tt_cart' || e.key === 'tt_wishlist') Store.refreshCounts();
  });

  /* ============================================================
     PRODUCT LINKS — every product card (Shop grid, Home highlights,
     "You May Also Like") must point at ITS OWN product, not a fixed page.
     ============================================================ */
  const SWATCH_HEX = { maroon: '#7A2231', gold: '#C9A24B', sage: '#6E7A5C', ivory: '#F2EBDC', midnight: '#262E45', blush: '#D9A9A2' };
  const COLOR_LABELS = { maroon: 'Deep Maroon', gold: 'Antique Gold', sage: 'Sage Green', ivory: 'Ivory', midnight: 'Midnight Blue', blush: 'Blush Pink' };

  function slugifyName(name) {
    return (name || '').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Shared HTML-escaping helper — used anywhere user-supplied or otherwise untrusted
  // strings (cart line names/customization text, wishlist items, order history, etc.)
  // are interpolated into innerHTML. Prevents stored/self XSS from data that ultimately
  // originates from request bodies the backend accepts largely as-is (e.g. POST /api/cart).
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Cache-busting for product photos. Product images are plain files under /images and
  // are referenced by filename only (e.g. "images/baby-birth-hoop.jpg"). When a product photo is
  // replaced, it's common for the new file to be saved over the old one under the exact
  // same filename — the URL never changes, so browsers that already have that URL in
  // their HTTP cache keep serving the old bytes instantly on load, then swap to the new
  // ones a moment later once the cache entry revalidates over the network. That's the
  // "old image for ~1s, then the new one" flicker. CSS/JS assets already avoid this with
  // a "?v=" query string bumped on every change (see the asset versioning fix); apply the
  // same convention to product photos so a stale cache can never be painted first.
  // Bump IMG_VERSION whenever image files are replaced in place (same filename, new bytes).
  // Bumped 20260808: images/panda-embroidered-hoodie.jpg was resized/recompressed in
  // place (1600x2133 810KB -> 768x1024 ~190KB) as part of a performance pass — without
  // this bump, anyone with the old file already in their HTTP cache (which is exactly
  // what happened to this image's own dynamically-rendered instances even after its
  // last replacement, since only the two hardcoded static <img> tags for it in
  // shop.html/collections.html had their ?v= bumped that time, not this shared
  // constant that every API-rendered product card's image goes through) would keep
  // being served the old, much heavier file indefinitely.
  const IMG_VERSION = '20260808';
  function withImgVersion(src) {
    if (!src) return src;
    return src + (src.indexOf('?') === -1 ? '?' : '&') + 'v=' + IMG_VERSION;
  }

  // BUG FIX: the product-detail thumbnails were showing the full-size photo
  // (768px+ wide) squeezed into a 78px box purely via CSS — a browser's generic
  // downscale of a large photo to a tiny box looks noticeably soft/less crisp
  // than the same photo shown at its intended (larger) size, which is exactly
  // why the main image looked clear but the small thumbnails didn't. Fix: use a
  // pre-cropped, pre-sharpened 240x240 thumbnail (images/thumbs/<file>) for the
  // small thumbnail strip specifically, while the big .pd-main image continues
  // to use the original full-size photo. Falls back to the original file if a
  // dedicated thumb version doesn't exist for some image.
  function thumbImgSrc(src) {
    if (!src) return src;
    const clean = src.split('?')[0];
    const slashIdx = clean.lastIndexOf('/');
    const dir = slashIdx === -1 ? '' : clean.slice(0, slashIdx + 1);
    const file = slashIdx === -1 ? clean : clean.slice(slashIdx + 1);
    return withImgVersion(dir + 'thumbs/' + file);
  }

  // Only allow http(s) (or protocol-relative/relative) URLs into src/href attributes.
  // Blocks `javascript:`/`data:`/etc. schemes that would otherwise execute when a
  // crafted image or link URL (e.g. a cart item's img, or a review photo URL) is clicked
  // or rendered.
  function safeUrl(url) {
    const value = String(url == null ? '' : url).trim();
    if (!value) return '';
    if (/^(https?:)?\/\//i.test(value)) return escapeHtml(value);
    if (/^[a-z0-9_\-./]/i.test(value) && !/^[a-z][a-z0-9+.\-]*:/i.test(value)) return escapeHtml(value);
    return '';
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
    const photo = (p.images && p.images.length && p.images[0]) ? withImgVersion(p.images[0]) : '';
    const href = productHref(p);
    // Same "no photo" placeholder used when a product has no image at all — kept as
    // markup here so a *broken* image (file missing/404 on the server) can fall back
    // to it too, instead of leaving a blank box with just the img-placeholder's
    // background pattern showing through, which is what a bare <img> with a dead src
    // renders as. The placeholder starts hidden and is only revealed by the <img>'s
    // onerror handler below — a successfully-loading photo never shows it.
    const placeholderMarkup = `<div class="ph-inner"${photo ? ' style="display:none"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <span class="ph-label">Product Image</span>
        <span class="ph-dim">1200 x 1500</span>
      </div>`;
    const mediaInner = photo
      ? `<img src="${photo}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${placeholderMarkup}`
      : placeholderMarkup;
    return `<div class="product-card reveal in" data-href="${href}">
  <div class="pc-media">
    <div class="img-placeholder ar-portrait">
      ${mediaInner}
    </div>
    ${tag ? `<span class="pc-tag">${tag}</span>` : ''}
    <div class="pc-actions">
      <button class="pc-icon-btn" data-wish-toggle data-id="${p._id || ''}" data-name="${p.name}" data-price="${priceStr}" data-img="${photo}" aria-label="Add ${p.name} to wishlist"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s-7.4-4.6-10-9.2C.5 8 2.1 4.6 5.6 4.2c2-.2 3.8.8 5 2.4 1.2-1.6 3-2.6 5-2.4 3.5.4 5.1 3.8 3.6 7.6-2.6 4.6-10 9.2-10 9.2z"/></svg></button>
      <button class="pc-icon-btn" data-quick-add data-id="${p._id || ''}" data-name="${p.name}" data-price="${priceStr}" data-img="${photo}" aria-label="Quick add ${p.name} to bag"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 8h11l-1 12h-9l-1-12z"/><path d="M9.2 8V6.2a2.8 2.8 0 015.6 0V8"/></svg></button>
    </div>
  </div>
  <a href="${href}" class="pc-info">
    <div class="pc-cat">${Array.isArray(p.category) ? p.category.join(' • ') : (p.category || '')}</div>
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
      if (card.classList.contains('is-loading')) return; // neutral skeleton, no real product to link to
      // Cards inside #homeFeaturedGrid are the pre-fetch fallback for "Newly stitched
      // and best loved" — apiRequest('/products?sort=featured&limit=6') below always
      // replaces them shortly after load with real cards whose hrefs come straight
      // from productHref(p) using the product's actual slug/_id. Guessing a href here
      // instead — slugifying the hardcoded fallback title client-side — is exactly the
      // bug: that guess doesn't have to match the real database slug. If it happens to
      // coincidentally match a DIFFERENT real product's slug, a click during this brief
      // window navigates to that unrelated product, not a stale copy of the right one.
      // Leave these cards inert (no href at all) until the authoritative fetch replaces
      // them — an inert click is a no-op, never a wrong navigation.
      if (card.closest('#homeFeaturedGrid')) {
        // Also strip any href already baked directly into the static markup's anchor.
        // A click on that <a> navigates natively and never reaches the card-level
        // dataset.href logic above, so leaving a hand-authored guess in place there
        // would still let this exact bug through.
        const staleLink = card.querySelector('.pc-info[href]');
        if (staleLink) staleLink.removeAttribute('href');
        return;
      }
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

  /* ============================================================
     HEADER SEARCH — live suggestions, present on every page.
     Reuses the same /api/products?q= endpoint the Shop page's own
     search box already calls, and "View all results" hands off to
     Shop with ?q= so the full filter/sort/pagination UI takes over.
     ============================================================ */
  (function initHeaderSearch() {
    const toggleBtns = document.querySelectorAll('[data-search-toggle]');
    const panel = document.querySelector('[data-search-overlay]');
    if (!toggleBtns.length || !panel) return;

    const form = panel.querySelector('[data-search-form]');
    const input = panel.querySelector('#headerSearchInput');
    const closeBtn = panel.querySelector('[data-search-close]');
    const resultsEl = panel.querySelector('#headerSearchResults');
    let debounceId;
    let latestRequestId = 0;
    let activeIndex = -1;
    let lastQuery = '';

    function openPanel() {
      panel.hidden = false;
      // Next frame, so the `hidden` removal + `.open` transition don't collapse into
      // one un-animated jump (hidden elements can't transition).
      requestAnimationFrame(() => panel.classList.add('open'));
      toggleBtns.forEach(b => b.setAttribute('aria-expanded', 'true'));
      input.focus();
    }
    function closePanel() {
      panel.classList.remove('open');
      toggleBtns.forEach(b => b.setAttribute('aria-expanded', 'false'));
      setTimeout(() => { if (!panel.classList.contains('open')) panel.hidden = true; }, 280);
    }
    function isOpen() { return panel.classList.contains('open'); }

    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => (isOpen() ? closePanel() : openPanel()));
    });
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) { closePanel(); toggleBtns[0].focus(); }
    });
    document.addEventListener('click', (e) => {
      if (!isOpen()) return;
      if (panel.contains(e.target) || e.target.closest('[data-search-toggle]')) return;
      closePanel();
    });

    function priceOf(p) { return p.displayPrice || ('₹' + Number(p.price || 0).toLocaleString('en-IN')); }

    function renderResults(products, query) {
      activeIndex = -1;
      if (!products.length) {
        resultsEl.innerHTML = `<p class="hs-empty">No pieces found for &ldquo;${escapeHtml(query)}&rdquo;. Try a different word, or browse the full shop.</p>
          <a class="hs-view-all" href="shop.html?q=${encodeURIComponent(query)}">Browse All Pieces</a>`;
        return;
      }
      const items = products.map(p => {
        const photo = (p.images && p.images.length) ? withImgVersion(p.images[0]) : '';
        return `<a class="hs-result" role="option" href="${productHref(p)}">
          <span class="hs-result-thumb">${photo ? `<img src="${photo}" alt="" loading="lazy" width="48" height="48">` : ''}</span>
          <span class="hs-result-info">
            <span class="hs-result-name">${escapeHtml(p.name)}</span>
            <span class="hs-result-cat">${escapeHtml(Array.isArray(p.category) ? p.category.join(' • ') : (p.category || ''))}</span>
          </span>
          <span class="hs-result-price">${priceOf(p)}</span>
        </a>`;
      }).join('');
      resultsEl.innerHTML = `<div class="hs-section-label">Suggestions</div>
        <div class="hs-result-list">${items}</div>
        <a class="hs-view-all" href="shop.html?q=${encodeURIComponent(query)}">View All Results for &ldquo;${escapeHtml(query)}&rdquo;</a>`;
    }

    async function runSearch(query) {
      const requestId = ++latestRequestId;
      try {
        const data = await apiRequest('/products?q=' + encodeURIComponent(query) + '&limit=6');
        if (requestId !== latestRequestId) return; // superseded by a newer keystroke
        renderResults(data.products || [], query);
      } catch (err) {
        if (requestId !== latestRequestId) return;
        resultsEl.innerHTML = `<p class="hs-error">Could not load suggestions right now. Press Enter to search anyway.</p>`;
      }
    }

    if (input) {
      input.addEventListener('input', () => {
        const query = input.value.trim();
        lastQuery = query;
        clearTimeout(debounceId);
        input.setAttribute('aria-expanded', String(!!query));
        if (!query) {
          resultsEl.innerHTML = `<p class="hs-hint">Search hoops, linens, motifs&hellip; try &ldquo;initial hoop&rdquo; or &ldquo;linen napkin&rdquo;.</p>`;
          return;
        }
        if (query.length < 2) { resultsEl.innerHTML = ''; return; }
        debounceId = setTimeout(() => runSearch(query), 300);
      });

      input.addEventListener('keydown', (e) => {
        const options = Array.from(resultsEl.querySelectorAll('.hs-result'));
        if (e.key === 'ArrowDown' && options.length) {
          e.preventDefault();
          activeIndex = Math.min(activeIndex + 1, options.length - 1);
          options.forEach((o, i) => o.classList.toggle('is-active', i === activeIndex));
          options[activeIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp' && options.length) {
          e.preventDefault();
          activeIndex = Math.max(activeIndex - 1, 0);
          options.forEach((o, i) => o.classList.toggle('is-active', i === activeIndex));
          options[activeIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && activeIndex >= 0 && options[activeIndex]) {
          e.preventDefault();
          window.location.href = options[activeIndex].getAttribute('href');
        }
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = (input.value || '').trim();
        if (query) window.location.href = 'shop.html?q=' + encodeURIComponent(query);
      });
    }
  })();

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
      const product = btn.getAttribute('data-id') || undefined;
      if (Store.isWishlisted(name)) btn.classList.add('active');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const img = resolveProductImage(btn, '.pc-media');
        const added = Store.toggleWishlist({ product, name, price, img });
        btn.classList.toggle('active', added);
        showToast(added ? 'Added to your wishlist' : 'Removed from wishlist');
        pulseIconBtn(btn);
      });
    });
  }

  /* Brief scale pulse on a pc-icon-btn right after a click, alongside the
     existing showToast() message — purely visual, doesn't touch wishlist/
     cart state or the toast itself. Safe to call repeatedly. */
  function pulseIconBtn(btn) {
    btn.classList.remove('tt-pulse');
    // force reflow so the animation restarts if clicked again quickly
    void btn.offsetWidth;
    btn.classList.add('tt-pulse');
    setTimeout(() => btn.classList.remove('tt-pulse'), 460);
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
        const added = Store.addToCart({
          product: btn.getAttribute('data-id') || undefined,
          name: btn.getAttribute('data-name') || 'Talking-Thread Piece',
          price: btn.getAttribute('data-price') || '',
          img: resolveProductImage(btn, '.pc-media'),
          size: 'Medium — 12in', color: 'Antique Gold', text: '—', qty: 1
        });
        if (added) showToast('Added to your bag');
        pulseIconBtn(btn);
      }));
    });
  }

  bindWishToggleButtons();
  bindQuickAddButtons();
  hydrateStaticProductCardLinks();

  /* ============================================================
     HOME PAGE — "Newly stitched and best loved"
     The static cards above are only a pre-JS fallback, and
     hydrateStaticProductCardLinks() can only *guess* a slug from
     their hard-coded title text — which is what let a card link to
     product.html?slug=... for a product that doesn't actually exist
     in the database ("Product Not Found"). Once the API is reachable,
     replace them with the real featured/new/bestseller products and
     build each link with productHref()/productCardTemplate() from the
     product's real slug or _id — the exact same mapping the Shop
     page's grid uses — so every image and title opens the correct
     product.
     ============================================================ */
  const homeFeaturedGrid = document.getElementById('homeFeaturedGrid');
  if (homeFeaturedGrid) {
    (async () => {
      try {
        const data = await apiRequest('/products?sort=featured&limit=6');
        const rawProducts = data.products || [];
        // Defensive de-dupe: guard against the same product showing up twice in the
        // API response (a duplicate DB record, a re-run seed, a manual admin entry
        // that collides with an existing one, etc.) so the grid can never render two
        // cards for the same product no matter what the backend returns. Key on _id
        // first since it's the authoritative unique identifier; fall back to slug,
        // then name, for any legacy/partial records that might lack one.
        const seen = new Set();
        const products = rawProducts.filter((p) => {
          const key = String(p._id || p.slug || p.name || '').toLowerCase().trim();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (products.length) {
          homeFeaturedGrid.innerHTML = products.map(productCardTemplate).join('');
          bindWishToggleButtons(homeFeaturedGrid);
          bindQuickAddButtons(homeFeaturedGrid);
        }
        // If the API returns no products, leave the static fallback cards
        // (already hydrated above) in place rather than showing an empty section.
      } catch (err) {
        // API unreachable — keep showing the static fallback cards.
      }
    })();
  }

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

    // Collection cards further down the Shop page ("Prefer to browse by
    // collection?") link here as shop.html?collection=<name>. There's no
    // checkbox UI for "collection" (only Category/Size/Colour/Price), so it
    // can't flow through currentFilters() the way checked boxes do — it's
    // captured once from the URL at load and folded into every query below
    // until Reset Filters clears it.
    let urlCollectionFilter = new URLSearchParams(window.location.search).get('collection') || '';

    let state = { page: 1, limit: 9, products: [], pages: 1, total: 0 };
    let searchDebounce;
    // Bumped on every fetchAndRender call. Filter checkboxes/swatches and sort all call
    // refresh() immediately with no debounce, so a user toggling a couple of filters in
    // quick succession can have two requests in flight at once. Network timing doesn't
    // guarantee they resolve in the order they were sent — if the *older* request's
    // response lands after the newer one, it would overwrite the grid with the previous
    // (now-stale) set of products/images: a visible flash of the wrong photo before the
    // real, correct one appears. Each call captures the id it was issued with and, once
    // its response comes back, only applies it if it's still the most recent request.
    let latestRequestId = 0;

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
      else if (urlCollectionFilter) params.set('collection', urlCollectionFilter);
      if (f.size.length) params.set('size', f.size.join(','));
      if (f.color.length) params.set('color', f.color.join(','));
      if (f.availability.length) params.set('availability', f.availability.join(','));
      // BUG FIX (price filter returned 0 results when 2+ price checkboxes were
      // checked together, e.g. "Under ₹2,000" + "Above ₹3,500"): this used to merge
      // all checked buckets into a single overall min/max ("combine into one range").
      // That collapsing is only correct for a contiguous range. For two disjoint
      // buckets like the example above, the merged result was minPrice=3501 (from
      // "Above ₹3,500") and maxPrice=1999 (from "Under ₹2,000") — min > max, an
      // impossible range, so the API always returned an empty grid no matter what
      // was in stock. The backend already exposes exactly the right tool for this:
      // `priceBand`, which OR's the buckets together instead of intersecting them
      // into one range (see productController.js). Send the checked bucket keys
      // straight through to it instead of pre-merging them on the client.
      if (f.price.length) params.set('priceBand', f.price.join(','));
      if (sortSelect) params.set('sort', sortSelect.value);
      params.set('page', page);
      params.set('limit', state.limit);
      return params.toString();
    }

    function renderResultCount() {
      if (resultCountEl) resultCountEl.textContent = `${state.total} Piece${state.total === 1 ? '' : 's'}`;
    }

    function renderLoadMore() {
      if (!loadMoreWrap) return;
      loadMoreWrap.style.display = state.page < state.pages ? 'flex' : 'none';
    }

    // Snapshot of what's currently painted in the grid (name + image, in order) — used to
    // detect when an API response is identical to what's already on screen, so we can skip
    // tearing the grid down and rebuilding it. Replacing innerHTML unconditionally destroys
    // and recreates every <img>, which forces the browser to redecode/repaint each photo —
    // visible as a brief flicker even though the "new" image is the same as the old one.
    function currentGridSignature() {
      return Array.from(productGrid.querySelectorAll('.product-card')).map(card => {
        const title = (card.querySelector('.pc-title') || {}).textContent || '';
        const img = card.querySelector('.pc-media img');
        return title.trim() + '|' + (img ? img.getAttribute('src') : '');
      }).join('~~');
    }

    // ROOT CAUSE FIX (product images appearing to never load on the Shop page):
    // fetchAndRender()'s catch block used to only call showToast() on failure. A toast
    // auto-dismisses after a few seconds and leaves whatever was already in #productGrid
    // untouched — and on the very first load (or after changing filters/sort), what's
    // "already in #productGrid" is the neutral, image-less "Loading…" skeleton markup
    // baked into shop.html (see the big HTML comment above that markup). If the initial
    // GET /api/products request fails or times out for any reason (a slow cold start,
    // a dropped connection, a brief network blip), that skeleton was left on screen
    // permanently, with no visible error and no way to recover short of a manual page
    // refresh — which looks exactly like "product images are stuck / never loading",
    // even though every individual image file and URL is completely fine.
    // Fix: (1) one silent automatic retry shortly after a failed *initial* (non-append)
    // load, to ride out a transient blip without bothering the person at all, and
    // (2) if that retry also fails, replace the stuck skeleton with a real, visible
    // error state and a "Try Again" button — so the grid can never be left silently
    // empty forever. "Load more" failures (append === true) are unaffected: the
    // already-loaded products stay on screen and the existing toast + re-enabled button
    // is still exactly right there, since there's no skeleton to get stuck on.
    function renderGridError(message) {
      if (!productGrid) return;
      productGrid.innerHTML =
        '<div class="shop-grid-error" style="grid-column:1/-1;text-align:center;padding:48px 20px;">' +
        '<p style="margin:0 0 16px;">' + escapeHtml(message || 'Could not load products right now.') + '</p>' +
        '<button type="button" class="btn btn-secondary" id="shopGridRetryBtn">Try Again</button>' +
        '</div>';
      const retryBtn = document.getElementById('shopGridRetryBtn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          retryBtn.disabled = true;
          retryBtn.textContent = 'Retrying…';
          fetchAndRender(1, false);
        });
      }
    }

    async function fetchAndRender(page, append, isAutoRetry) {
      const requestId = ++latestRequestId;
      try {
        // ROOT CAUSE FIX (random product cards appearing duplicated on the Shop page):
        // "Load More" computes its next page as `state.page + 1`, but state.page is only
        // updated once a fetch actually *resolves*. Previously this button was only
        // disabled while an append (Load More) fetch was in flight — it stayed clickable
        // while a filter/search/sort change (append === false) was still loading. If
        // someone clicked Load More in that window, it read the OLD state.page (left over
        // from before the filter/search/sort change) but built its query with the NEW
        // filters — so it asked for "old page + 1" of a completely different result set,
        // which can overlap with whatever page 1 of the new filter turns out to be. The
        // overlap depends on exactly which filter/search/sort was mid-flight and what the
        // stale page number was, so different products would duplicate each time — matching
        // what was reported ("random alag-alag products duplicate hote hain").
        // Fix: disable Load More the instant ANY fetch starts (not just append ones), so a
        // click during a filter/search/sort request can never register in the first place —
        // this closes the stale-page window entirely instead of just narrowing it.
        if (loadMoreBtn) {
          loadMoreBtn.disabled = true;
          if (append) loadMoreBtn.textContent = 'Loading…';
        }
        const data = await apiRequest('/products?' + buildQuery(page));
        // A newer fetchAndRender() call has started since this one was sent — its own
        // response will land shortly and is what should end up on screen. Applying this
        // stale response now would flash the wrong products/images before the real ones
        // arrive, so drop it silently.
        if (requestId !== latestRequestId) return;

        state.page = data.page || page;
        state.pages = data.pages || 1;
        state.total = data.total || 0;

        const products = data.products || [];
        if (append) {
          const html = products.map(productCardTemplate).join('');
          productGrid.insertAdjacentHTML('beforeend', html);
        } else {
          const incomingSignature = products
            .map(p => (p.name || '').trim() + '|' + withImgVersion((p.images && p.images[0]) || ''))
            .join('~~');
          if (incomingSignature !== currentGridSignature()) {
            const html = products.map(productCardTemplate).join('');
            productGrid.innerHTML = html || '<p class="result-count">No pieces match these filters just yet.</p>';
          }
        }
        bindWishToggleButtons(productGrid);
        bindQuickAddButtons(productGrid);
        renderResultCount();
        renderLoadMore();
      } catch (err) {
        if (requestId !== latestRequestId) return; // a newer request superseded this one; don't surface its error
        if (!append && !isAutoRetry) {
          // First failure on an initial/refresh load: try once more, silently, shortly
          // after — covers a brief network blip or slow cold start without ever
          // bothering the person if the very next attempt just works.
          setTimeout(() => {
            if (requestId === latestRequestId) fetchAndRender(page, append, true);
          }, 1500);
          return;
        }
        if (!append) {
          // Auto-retry also failed (or this isn't the first load attempt) — don't leave
          // the skeleton stuck forever, show a real error state with a way to recover.
          renderGridError(err.message);
        } else {
          showToast(err.message || 'Could not load products right now.');
        }
      } finally {
        if (requestId === latestRequestId && loadMoreBtn) { loadMoreBtn.textContent = 'Load More Pieces'; loadMoreBtn.disabled = false; }
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
        urlCollectionFilter = ''; // also clear whichever collection card was clicked to get here
        refresh();
      });
    }

    // Pagination — "Load More" appends the next page
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => fetchAndRender(state.page + 1, true));
    }

    // Prefill from ?q= (header search's "View all results" links here with the query)
    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ && searchInput) searchInput.value = urlQ;

    // Prefill category checkboxes from ?category= (comma-separated), so the Filter
    // panel visibly reflects the active filter, same as ?collection= above does silently.
    const urlCategoryList = (new URLSearchParams(window.location.search).get('category') || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    if (urlCategoryList.length) {
      filterInputs.forEach(input => {
        if (input.tagName === 'INPUT' && input.getAttribute('data-filter') === 'category' && urlCategoryList.includes(input.value)) {
          input.checked = true;
        }
      });
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
    function renderProductData(p, relatedProducts) {
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

      // SEO BUG FIX: product.html is one shared template that renders every product
      // (via ?slug=), but the canonical link, og:url, og:image, twitter:image and both
      // JSON-LD blocks (Product + BreadcrumbList) were left as static markup for a
      // single hardcoded product ("Baby Birth Announcement Embroidery Hoop") and were
      // never updated here — only title/description/og:title/og:description/
      // twitter:title/twitter:description were. Effects of the gap:
      //  - Every product's canonical/og:url pointed at the exact same bare
      //    "/product.html", telling Google all 16 product pages are duplicates of one
      //    page — the other 15 had effectively no chance of being indexed on their own.
      //  - A shared WhatsApp/Facebook/Twitter link for any product except that one
      //    showed the WRONG name, WRONG price and a MISMATCHED photo
      //    (welcome-home-rose-hoop.jpg, not even that product's own image).
      //  - Google's Product rich-result data (price/availability) was wrong for 15/16
      //    products, and the breadcrumb rich result always said "Baby Birth
      //    Announcement Embroidery Hoop" regardless of the page actually crawled.
      // sitemap.xml has a matching fix (real per-product URLs added) — this is the
      // runtime half of that fix, so the tags always match whichever product loaded.
      const SITE_ORIGIN = 'https://talking-threads.onrender.com';
      const canonicalUrl = SITE_ORIGIN + '/' + productHref(p);
      const absImage = mainPhotoUrl => mainPhotoUrl ? (SITE_ORIGIN + '/' + mainPhotoUrl) : '';
      setMeta('#canonicalLink', 'href', canonicalUrl);
      setMeta('#ogUrl', 'content', canonicalUrl);
      setMeta('#ogPriceAmount', 'content', String(p.price || ''));
      const ogImg = absImage((p.images && p.images.length) ? withImgVersion(p.images[0]) : '');
      if (ogImg) {
        setMeta('#ogImage', 'content', ogImg);
        setMeta('#twitterImage', 'content', ogImg);
      }
      const productJsonLdEl = document.getElementById('productJsonLd');
      if (productJsonLdEl) {
        productJsonLdEl.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.name,
          description: blurb,
          image: ogImg || undefined,
          brand: { '@type': 'Brand', name: 'Talking-Thread' },
          offers: {
            '@type': 'Offer',
            url: canonicalUrl,
            priceCurrency: 'INR',
            price: String(p.price || ''),
            availability: (p.availability === 'Out of Stock') ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition'
          }
        });
      }
      const breadcrumbJsonLdEl = document.getElementById('breadcrumbJsonLd');
      if (breadcrumbJsonLdEl) {
        breadcrumbJsonLdEl.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN + '/' },
            { '@type': 'ListItem', position: 2, name: 'Shop', item: SITE_ORIGIN + '/shop.html' },
            { '@type': 'ListItem', position: 3, name: p.name, item: canonicalUrl }
          ]
        });
      }

      // Images: main photo + up to 4 thumbnails. The product's own photo(s) come
      // first; when it only has one, the remaining thumb slots are filled with the
      // first photo of other products in the same category (the "related products"
      // list) instead of just repeating the main photo — so the thumbs strip shows
      // other handkerchief designs (e.g. penguin-balloon, krishna-quote, hugging-bears)
      // rather than 4 copies of the same image. Only falls back to repeating the main
      // photo if there aren't enough related products with images to fill the strip.
      const photos = ((p.images && p.images.length) ? p.images : []).map(withImgVersion);
      const mainPhoto = photos[0] || '';
      const relatedImages = (relatedProducts || [])
        .map(rp => (rp.images && rp.images.length) ? withImgVersion(rp.images[0]) : null)
        .filter(Boolean);
      const gallery = [];
      photos.concat(relatedImages).forEach(src => {
        if (src && gallery.length < 4 && !gallery.includes(src)) gallery.push(src);
      });
      while (gallery.length < 4 && mainPhoto) gallery.push(mainPhoto);
      const thumbLabels = ['Front View', 'Detail — Stitch Close-up', 'Styled on Wall', 'Back & Packaging'];
      const thumbsLeft = document.querySelector('.pd-thumbs-left');
      const thumbsRight = document.querySelector('.pd-thumbs-right');
      if (thumbsLeft && thumbsRight) {
        // data-full carries the full-size photo so clicking a thumb swaps .pd-main
        // to the sharp original — not the small pre-sharpened thumbnail file, which
        // is only meant for the tiny thumbnail strip itself.
        const thumbHtml = (label, i) => `
          <div class="pd-thumb${i === 0 ? ' active' : ''}" data-label="${label}" data-full="${gallery[i] || mainPhoto}">
            <div class="img-placeholder ar-square"><img src="${thumbImgSrc(gallery[i] || mainPhoto)}" alt="${label}" loading="lazy" decoding="async"></div>
          </div>`;
        thumbsLeft.innerHTML = thumbLabels.map(thumbHtml).filter((_, i) => i % 2 === 0).join('');
        thumbsRight.innerHTML = thumbLabels.map(thumbHtml).filter((_, i) => i % 2 === 1).join('');
      }
      const pdMain = document.querySelector('.pd-main');
      if (pdMain) pdMain.innerHTML = `<div class="img-placeholder ar-portrait"><img src="${mainPhoto}" alt="${p.name}" loading="eager" fetchpriority="high" decoding="async"></div>`;

      const categoryText = Array.isArray(p.category) ? p.category.join(' • ') : (p.category || '');
      const catLabel = categoryText + (p.collections && p.collections.length ? ' — ' + p.collections[0] : '');
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
      if (addBtn) {
        addBtn.setAttribute('data-id', p._id || '');
        addBtn.setAttribute('data-name', p.name);
        addBtn.setAttribute('data-price', priceStr);
        addBtn.disabled = false;
        addBtn.textContent = 'Add to Cart';
      }
      const pdWish = document.getElementById('pdWishBtn');
      if (pdWish) {
        pdWish.setAttribute('data-id', p._id || '');
        pdWish.setAttribute('data-name', p.name);
        pdWish.setAttribute('data-price', priceStr);
        pdWish.disabled = false;
      }
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
          const fullSrc = thumb.getAttribute('data-full');
          if (mainImg && thumbImg) {
            mainImg.classList.add('is-swapping');
            setTimeout(() => {
              mainImg.setAttribute('src', fullSrc || thumbImg.getAttribute('src'));
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
          const product = addBtn.getAttribute('data-id') || undefined;
          const name = addBtn.getAttribute('data-name') || 'Talking-Thread Piece';
          const price = addBtn.getAttribute('data-price') || '';
          const mainImg = document.querySelector('.pd-main img');
          const added = Store.addToCart({
            product, name, price,
            img: (mainImg && mainImg.getAttribute('src')) || '',
            size: selectedSize || 'Medium — 12in',
            color: selectedColor || 'Antique Gold',
            text: (customText && customText.value.trim()) || '—',
            qty: parseInt(qtyInput ? qtyInput.value : '1', 10)
          });
          if (added) showToast('Added to your bag');
        }));
      }

      /* wishlist toggle on product page */
      const pdWish = document.getElementById('pdWishBtn');
      if (pdWish) {
        const product = pdWish.getAttribute('data-id') || undefined;
        const name = pdWish.getAttribute('data-name');
        if (Store.isWishlisted(name)) pdWish.classList.add('active');
        pdWish.addEventListener('click', () => {
          const mainImg = document.querySelector('.pd-main img');
          const added = Store.toggleWishlist({ product, name, price: pdWish.getAttribute('data-price'), img: (mainImg && mainImg.getAttribute('src')) || '' });
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

    // Shown when the requested slug/id doesn't match any product in the database (wrong
    // link, product renamed/removed, or the API is unreachable). Previously this case just
    // fired a toast and left whatever placeholder markup was already in the page fully
    // visible and interactive — so a broken link LOOKED like it had opened a real product
    // (often the same stale one, on every failed click), instead of clearly failing.
    function renderProductNotFound() {
      document.title = 'Product Not Found — Talking-Thread';
      const crumb = document.querySelector('.breadcrumb li[aria-current="page"]');
      if (crumb) crumb.textContent = 'Not Found';

      const pdMain = document.querySelector('.pd-main');
      if (pdMain) pdMain.innerHTML = '<div class="img-placeholder ar-portrait"><div class="ph-inner"><span class="ph-label">Product Not Found</span></div></div>';
      const thumbsLeft = document.querySelector('.pd-thumbs-left');
      const thumbsRight = document.querySelector('.pd-thumbs-right');
      if (thumbsLeft) thumbsLeft.innerHTML = '';
      if (thumbsRight) thumbsRight.innerHTML = '';

      const pcCat = document.querySelector('.pd-info > .pc-cat');
      if (pcCat) pcCat.textContent = '';
      const h1 = document.querySelector('.pd-info h1');
      if (h1) h1.textContent = "Sorry, we couldn't find that piece";
      const priceRow = document.querySelector('.pd-price-row');
      if (priceRow) priceRow.innerHTML = '';
      const desc = document.querySelector('.pd-desc');
      if (desc) desc.textContent = 'This product may have been renamed, removed, or the link is out of date. Please head back to the shop to find it.';
      const sizePills = document.querySelector('.size-pills');
      if (sizePills) sizePills.innerHTML = '';
      const colorOptions = document.querySelector('.color-options');
      if (colorOptions) colorOptions.innerHTML = '';

      const addBtn = document.getElementById('addToCartBtn');
      if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Unavailable'; }
      const pdWish = document.getElementById('pdWishBtn');
      if (pdWish) pdWish.disabled = true;

      const related = document.querySelector('.related-products');
      if (related) related.style.display = 'none';
    }

    const productKey = new URLSearchParams(window.location.search).get('slug')
      || new URLSearchParams(window.location.search).get('id');

    if (productKey) {
      Promise.all([
        apiRequest('/products/' + encodeURIComponent(productKey)),
        apiRequest('/products/' + encodeURIComponent(productKey) + '/related').catch(() => null)
      ])
        .then(([data, relData]) => {
          renderProductData(data.product, relData && relData.products);
          bindProductInteractions();
          if (relData) renderRelated(relData.products);
        })
        .catch(err => {
          showToast(err.message || 'Could not load that product.');
          renderProductNotFound();
          bindProductInteractions(); // still let people interact with whatever is on the page
        });
    } else {
      // No product specified in the URL (e.g. someone opened product.html directly).
      // The gallery/title/price/buy-buttons in the HTML are a neutral loading skeleton,
      // not a real product — with no slug to fetch, nothing will ever fill it in, so
      // show the same "not found" state used for an unresolvable slug rather than
      // leaving the page stuck on "Loading…" forever.
      renderProductNotFound();
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

      cartList.innerHTML = cart.map(item => {
        const hasImg = item.img && item.img !== 'undefined' && item.img !== 'null';
        // Same broken/retired-image fallback as the wishlist grid — see the comment there.
        const placeholder = `<div class="ph-inner"${hasImg ? ' style="display:none"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span class="ph-label">${escapeHtml(item.name)}</span></div>`;
        return `
        <div class="cart-item" data-id="${escapeHtml(item.id)}">
          <div class="img-placeholder ar-square">
            ${hasImg
              ? `<img src="${safeUrl(item.img)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${placeholder}`
              : placeholder}
          </div>
          <div>
            <div class="ci-title">${escapeHtml(item.name)}</div>
            <div class="ci-meta">
              <div><b>Size:</b> ${escapeHtml(item.size)}</div>
              <div><b>Thread:</b> ${escapeHtml(item.color)}</div>
              <div><b>Embroidered text:</b> ${escapeHtml(item.text)}</div>
            </div>
            <div class="qty-stepper qty-stepper--sm">
              <button class="qty-minus" data-act="dec">−</button>
              <input type="text" value="${escapeHtml(item.qty || 1)}" readonly>
              <button class="qty-plus" data-act="inc">+</button>
            </div>
          </div>
          <div class="ci-right">
            <div class="ci-price">${escapeHtml(item.price)}</div>
            <button class="ci-remove" data-act="remove">Remove</button>
          </div>
        </div>
      `;
      }).join('');

      cartList.querySelectorAll('.cart-item').forEach(el => {
        const id = el.getAttribute('data-id');
        const item = cart.find(i => i.id === id);
        el.querySelector('[data-act="inc"]').addEventListener('click', guardAgainstDoubleFire(() => Store.updateCartQty(id, (item.qty || 1) + 1)));
        el.querySelector('[data-act="dec"]').addEventListener('click', guardAgainstDoubleFire(() => Store.updateCartQty(id, (item.qty || 1) - 1)));
        el.querySelector('[data-act="remove"]').addEventListener('click', guardAgainstDoubleFire(() => { Store.removeFromCart(id); showToast('Removed from bag'); }));
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

    /* ...and also when tt_cart changes in a DIFFERENT tab (e.g. an item added, or an
       order placed and the bag cleared, over there) — the wrapped setCart above only
       ever fires for this tab's own writes. */
    window.addEventListener('storage', (e) => {
      if (e.key === 'tt_cart') render();
    });

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
      // ROOT CAUSE FIX: this used to trust that whoever calls openCheckoutModal() had
      // already verified the person was signed in — true for the checkoutBtn handler
      // below, but nothing stopped some other path (a future feature, a leftover cart
      // from before a fix, a race between two handlers) from calling this directly and
      // skipping that check. The modal itself now refuses to open for anyone who isn't
      // signed in, no matter how it was triggered.
      if (!Auth.requireLogin('Please sign in to complete your order.')) return;
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
      checkoutBtn.addEventListener('click', async () => {
        // Authentication is checked before any cart/checkout action — first, before
        // even looking at cart contents — so a guest is always sent to sign in rather
        // than ever reaching a state that depends on cart contents.
        if (!Auth.requireLogin('Please sign in to complete your order.')) return;
        if (!Store.getCart().length) return;
        // Reconcile the server's cart with what's on screen BEFORE opening the checkout
        // modal — see Store.ensureServerSynced() for why this is required, not optional.
        // A brief button-disable here is a small price for guaranteeing "what you see in
        // the bag is what checkout will actually charge/ship."
        const originalLabel = checkoutBtn.textContent;
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Preparing checkout…';
        const synced = await Store.ensureServerSynced();
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = originalLabel;
        if (!synced) {
          showToast('Could not reach the server to confirm your bag — please check your connection and try again.');
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
          // Second safety net: re-confirm the server cart matches localStorage right
          // before creating the order. The checkoutBtn handler already does this once
          // before the modal opens, but the shopper may have taken a while filling in the
          // address, so re-check here rather than assume nothing changed in the meantime.
          const stillSynced = await Store.ensureServerSynced();
          if (!stillSynced) {
            throw new Error('Could not reach the server to confirm your bag — please check your connection and try again.');
          }
          if (!Store.getCart().length) {
            throw new Error('Your bag is empty.');
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
        // Same "no photo" placeholder used on shop/product cards — kept as markup here
        // so a *broken* image (retired/renamed file, 404 on the server) falls back to it
        // too, instead of leaving the browser's default broken-image icon showing, which
        // is what a bare <img> with a dead src renders as. Starts hidden and is only
        // revealed by the <img>'s onerror handler below — a successfully-loading photo
        // never shows it. This is what fixed the "sometimes the photo shows, sometimes
        // it doesn't" wishlist bug: items saved before a product's image was retired/
        // renamed still had the old (now-dead) path in localStorage, and this page — unlike
        // the shop grid — had no onerror fallback, so those items rendered a broken icon
        // instead of the placeholder.
        const placeholder = `<div class="ph-inner"${hasImg ? ' style="display:none"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span class="ph-label">${escapeHtml(item.name)}</span></div>`;
        return `
        <div class="product-card" data-idx="${idx}">
          <div class="pc-media">
            <div class="img-placeholder ar-portrait">
              ${hasImg
                ? `<img src="${safeUrl(item.img)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${placeholder}`
                : placeholder}
            </div>
          </div>
          <div class="pc-info">
            <div class="pc-title">${escapeHtml(item.name)}</div>
            <div class="pc-price">${escapeHtml(item.price)}</div>
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
          const added = Store.addToCart({ product: item.product || undefined, name: item.name, price: item.price, img: item.img || '', size: 'Medium — 12in', color: 'Antique Gold', text: '—', qty: 1 });
          if (!added) return; // not signed in — Store.addToCart already redirected to login
          Store.setWishlist(Store.getWishlist().filter((i) => i.id !== item.id));
          if (Auth.isLoggedIn()) apiRequest('/wishlist/' + encodeURIComponent(item.id), { method: 'DELETE', keepalive: true }).catch(() => {});
          render();
          showToast('Moved to your bag');
        });
      });
    };
    render();

    /* keep this tab's wishlist grid correct if a DIFFERENT tab changes tt_wishlist
       (toggled a heart, moved an item to bag, etc.) — same reasoning as the Cart page. */
    window.addEventListener('storage', (e) => {
      if (e.key === 'tt_wishlist') render();
    });
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
            <div class="oi-name">${escapeHtml(i.name)} <span class="oi-meta">&times; ${escapeHtml(i.qty || 1)}</span></div>
            <div class="oi-meta">Size: ${escapeHtml(i.size || '—')} &middot; Thread: ${escapeHtml(i.color || '—')}</div>
          </div>
          <div>${escapeHtml(i.price || '')}</div>
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
    // If already signed in, don't show the login form again — send them back
    // to wherever they were headed (if anywhere), otherwise home
    if (Auth.isLoggedIn()) {
      showToast("You're already signed in.");
      window.location.href = Auth.consumeRedirect() || 'index.html';
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
        const redirectTo = Auth.consumeRedirect() || 'index.html';
        setTimeout(() => { window.location.href = redirectTo; }, 800);
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
    // If already signed in, don't show the register form again — send them back
    // to wherever they were headed (if anywhere), otherwise home
    if (Auth.isLoggedIn()) {
      showToast("You're already signed in.");
      window.location.href = Auth.consumeRedirect() || 'index.html';
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
        const redirectTo = Auth.consumeRedirect() || 'index.html';
        setTimeout(() => { window.location.href = redirectTo; }, 800);
      } catch (err) {
        showToast(err.message || 'Could not create account.');
        setSubmitting(registerForm, false);
      }
    });
  }

  /* ---------- "Continue with Google" (login.html / register.html) ---------- */
  document.querySelectorAll('.social-row button').forEach(btn => {
    if (!btn.textContent.trim().toLowerCase().includes('google')) return; // leave the Apple button as-is, not implemented
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      // sessionStorage survives the round trip to Google's consent screen and back
      // (same tab, same origin on return), so whatever requireLogin() already
      // stashed as the return target (e.g. the product page the add-to-cart
      // attempt happened on) is still there when handleGoogleAuthRedirect() runs.
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
          ${photos.length ? `<div class="review-photos">${photos.slice(0, 3).map(p => `<a href="${safeUrl(p)}" target="_blank" rel="noopener noreferrer"><img src="${safeUrl(p)}" alt="Photo from ${safeName}'s review" loading="lazy"></a>`).join('')}</div>` : ''}
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
        // Google always lands us back on index.html?auth=google_success — if the
        // user actually started this from an add-to-cart prompt on another page,
        // send them back there now instead of leaving them on the homepage.
        const redirectTo = Auth.consumeRedirect();
        if (redirectTo) { window.location.href = redirectTo; return; }
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
      // NOT icon-btn-ext — that class is deliberately display:none in the header
      // (see the "exactly 3 action icons" rule in style.css, which Contact also
      // uses and is likewise hidden there). icon-btn-myorders instead mirrors
      // icon-btn-account's desktop-only visibility, since mobile already has
      // its own "My orders" link in the drawer.
      link.className = 'icon-btn icon-btn-myorders';
      link.setAttribute('aria-label', 'My Orders');
      link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.5 21 7v10L12 21.5 3 17V7l9-4.5Z"/><path d="M3 7l9 4.5L21 7"/><path d="M12 11.5V21.5"/></svg>';
      const cartIcon = headerIcons.querySelector('a[href="cart.html"]');
      if (cartIcon) headerIcons.insertBefore(link, cartIcon);
      else headerIcons.appendChild(link);
    }
    // The mobile drawer already ships with a static "My orders" link inside
    // .mobile-panel-account (added directly to the markup), so there is
    // nothing left to inject there — doing so used to risk a duplicate entry.
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
      // .scrolled compresses .nav's padding slightly (see style.css) — a
      // purely visual settle-in on top of the shadow set above.
      header.classList.toggle('scrolled', window.scrollY > 8);
    });
  }

  /* ---------- Hero stat count-up ----------
     Animates any [data-count-to] element from 0 to its target once it
     scrolls into view. The element's original text (e.g. "500+") is kept
     as-is until then, so nothing changes for no-JS / reduced-motion. */
  (function initCountUp() {
    const els = document.querySelectorAll('[data-count-to]');
    if (!els.length) return;
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-count-to'), 10);
        const suffix = el.getAttribute('data-count-suffix') || '';
        if (Number.isNaN(target)) { io.unobserve(el); return; }
        const duration = 1100;
        const start = performance.now();
        function tick(now) {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(eased * target) + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.6 });
    els.forEach(el => io.observe(el));
  })();
});