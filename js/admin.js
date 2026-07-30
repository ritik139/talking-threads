/* ==========================================================================
   Talking-Thread — Admin Dashboard (Orders)
   Standalone script for admin-dashboard.html only.
   ========================================================================== */
(function () {
  'use strict';

  const API_BASE = '/api';
  const API_TIMEOUT_MS = 15000;

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
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('The server took too long to respond.');
      throw new Error('Could not reach the server. Please make sure the backend is running.');
    } finally {
      clearTimeout(timeoutId);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw new Error((data && data.message) || `Request failed (${res.status})`);
    return data;
  }

  const gate = document.getElementById('adminGate');
  const shell = document.getElementById('adminShell');
  const whoName = document.getElementById('adminWhoName');
  const logoutBtn = document.getElementById('adminLogoutBtn');

  /* ============================================================
     Dashboard init — opens directly, no admin sign-in/role check.
     ============================================================ */
  async function init() {
    if (gate) gate.style.display = 'none';
    shell.style.display = 'grid';
    if (whoName) whoName.textContent = 'Admin';

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    loadOrders();
    initRealtimeNotifications();
  }

  /* ============================================================
     Orders
     ============================================================ */
  let allOrders = [];

  const ordersList = document.getElementById('adminOrdersList');
  const searchInput = document.getElementById('adminSearch');
  const statusFilter = document.getElementById('adminStatusFilter');
  const countEl = document.getElementById('adminOrderCount');

  function money(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  }

  function formatDateTime(iso) {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return ''; }
  }

  function addressLines(addr) {
    if (!addr) return 'No shipping address on file.';
    const parts = [addr.line1, addr.line2, [addr.city, addr.state].filter(Boolean).join(', '), addr.postalCode, addr.country]
      .filter(Boolean)
      .map(escapeAdminHtml);
    return parts.length ? parts.join('<br>') : 'No shipping address on file.';
  }

  function orderCard(order) {
    const customerNameRaw = (order.shippingAddress && order.shippingAddress.fullName) || (order.user && order.user.name) || 'Guest';
    const customerEmailRaw = (order.user && order.user.email) || '—';
    const customerPhoneRaw = (order.shippingAddress && order.shippingAddress.phone) || (order.user && order.user.phone) || '—';
    const customerName = escapeAdminHtml(customerNameRaw);
    const customerEmail = escapeAdminHtml(customerEmailRaw);
    const customerPhone = escapeAdminHtml(customerPhoneRaw);
    // Used only inside the mailto: href — encodeURIComponent handles the URL context,
    // escapeAdminHtml (above) handles the HTML/attribute context; both are needed since
    // this value is customer-controlled.
    const customerEmailHref = encodeURIComponent(customerEmailRaw);
    const status = order.status || 'pending';
    const paymentStatus = order.paymentStatus || 'pending';

    const itemsRows = (order.items || []).map(i => `
      <tr>
        <td>${escapeAdminHtml(i.name || '')}</td>
        <td>${escapeAdminHtml(i.size || '—')} / ${escapeAdminHtml(i.color || '—')}</td>
        <td>${Number(i.qty) || 1}</td>
        <td>${escapeAdminHtml(i.price || '')}</td>
      </tr>
    `).join('');

    return `<div class="admin-order-card" data-order-id="${order._id}">
      <div class="admin-order-head" data-toggle>
        <div>
          <div class="admin-order-id">${order.orderNumber}</div>
          <div class="admin-order-meta">${customerName} &middot; ${formatDateTime(order.createdAt)}</div>
        </div>
        <div class="admin-badges">
          <span class="admin-badge status-${status}">${status}</span>
          <span class="admin-badge pay-${paymentStatus}">${paymentStatus}</span>
        </div>
        <div class="admin-order-total">${money(order.total)}</div>
        <svg class="admin-chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="admin-order-body">
        <div class="admin-grid-2">
          <div class="admin-block">
            <h4>Customer</h4>
            <p><strong>${customerName}</strong></p>
            <p><a href="mailto:${customerEmailHref}">${customerEmail}</a></p>
            <p>${customerPhone}</p>
          </div>
          <div class="admin-block">
            <h4>Shipping Address</h4>
            <p>${addressLines(order.shippingAddress)}</p>
          </div>
        </div>

        <div class="admin-block">
          <h4>Items</h4>
          <table class="admin-items-table">
            <thead><tr><th>Item</th><th>Size / Colour</th><th>Qty</th><th>Price</th></tr></thead>
            <tbody>${itemsRows || '<tr><td colspan="4">No items on this order.</td></tr>'}</tbody>
          </table>
        </div>

        <div class="admin-grid-2">
          <div class="admin-block">
            <h4>Order Total</h4>
            <p>Subtotal: ${money(order.subtotal)}</p>
            <p>Shipping: ${order.shipping ? money(order.shipping) : 'Free'}</p>
            <p><strong>Total: ${money(order.total)}</strong></p>
          </div>
          <div class="admin-block">
            <h4>Payment</h4>
            <p>Method: ${(order.paymentMethod || 'cod').toUpperCase()}</p>
            <p>Status: ${paymentStatus}</p>
          </div>
        </div>

        <div class="admin-order-actions">
          <div>
            <label for="status-${order._id}">Order Status</label>
            <select id="status-${order._id}" data-act="update-status">
              ${['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
                .map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="pay-${order._id}">Payment Status</label>
            <select id="pay-${order._id}" data-act="update-payment">
              ${['pending', 'paid', 'refunded']
                .map(s => `<option value="${s}" ${s === paymentStatus ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>`;
  }

  function applyFilters() {
    const q = (searchInput && searchInput.value || '').trim().toLowerCase();
    const statusVal = statusFilter && statusFilter.value || '';

    return allOrders.filter(o => {
      if (statusVal && (o.status || 'pending') !== statusVal) return false;
      if (!q) return true;
      const haystack = [
        o.orderNumber,
        o.user && o.user.name,
        o.user && o.user.email,
        o.shippingAddress && o.shippingAddress.fullName,
        o.shippingAddress && o.shippingAddress.phone
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  function render() {
    const filtered = applyFilters();
    if (countEl) countEl.textContent = `${filtered.length} order${filtered.length === 1 ? '' : 's'}`;

    if (!filtered.length) {
      ordersList.innerHTML = '<div class="admin-empty">No orders match your search/filter.</div>';
      return;
    }

    ordersList.innerHTML = filtered.map(orderCard).join('');

    ordersList.querySelectorAll('[data-toggle]').forEach(head => {
      head.addEventListener('click', () => {
        head.closest('.admin-order-card').classList.toggle('open');
      });
    });

    ordersList.querySelectorAll('[data-act="update-status"]').forEach(sel => {
      sel.addEventListener('click', (e) => e.stopPropagation());
      sel.addEventListener('change', async (e) => {
        e.stopPropagation();
        const card = sel.closest('.admin-order-card');
        const orderId = card.getAttribute('data-order-id');
        const newStatus = sel.value;
        const order = allOrders.find(o => o._id === orderId);
        const previousStatus = order ? order.status : sel.dataset.previousValue;
        try {
          await apiRequest(`/orders/${encodeURIComponent(orderId)}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
          });
          if (order) order.status = newStatus;
          render();
        } catch (err) {
          alert(err.message || 'Could not update order status.');
          sel.value = previousStatus; // the save failed — don't leave the dropdown showing an unsaved change
        }
      });
    });

    ordersList.querySelectorAll('[data-act="update-payment"]').forEach(sel => {
      sel.addEventListener('click', (e) => e.stopPropagation());
      sel.addEventListener('change', async (e) => {
        e.stopPropagation();
        const card = sel.closest('.admin-order-card');
        const orderId = card.getAttribute('data-order-id');
        const newStatus = sel.value;
        const order = allOrders.find(o => o._id === orderId);
        const previousStatus = order ? order.paymentStatus : sel.dataset.previousValue;
        try {
          await apiRequest(`/orders/${encodeURIComponent(orderId)}/payment-status`, {
            method: 'PUT',
            body: JSON.stringify({ paymentStatus: newStatus })
          });
          if (order) order.paymentStatus = newStatus;
          render();
        } catch (err) {
          alert(err.message || 'Could not update payment status.');
          sel.value = previousStatus; // the save failed — don't leave the dropdown showing an unsaved change
        }
      });
    });
  }

  async function loadOrders() {
    ordersList.innerHTML = '<div class="admin-loading">Loading orders…</div>';
    try {
      const data = await apiRequest('/orders/admin/all');
      allOrders = data.orders || [];
      render();
    } catch (err) {
      ordersList.innerHTML = `<div class="admin-error">${err.message || 'Could not load orders.'}</div>`;
    }
  }

  if (searchInput) searchInput.addEventListener('input', render);
  if (statusFilter) statusFilter.addEventListener('change', render);

  /* ============================================================
     Real-time "New Order" notifications (Socket.IO)
     ============================================================ */
  const notifBell = document.getElementById('adminNotifBell');
  const notifPanel = document.getElementById('adminNotifPanel');
  const notifList = document.getElementById('adminNotifList');
  const notifBadge = document.getElementById('adminNotifBadge');
  const toastStack = document.getElementById('adminToastStack');

  let unreadCount = 0;
  const notifLog = [];

  function updateBadge() {
    if (!notifBadge) return;
    if (unreadCount > 0) {
      notifBadge.style.display = 'flex';
      notifBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    } else {
      notifBadge.style.display = 'none';
    }
  }

  // A short two-tone chime built with the Web Audio API — no external sound file, so
  // there's nothing to license or fail to load.
  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1175].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16);
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + i * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.16);
        osc.stop(ctx.currentTime + i * 0.16 + 0.4);
      });
    } catch (e) { /* Web Audio not available — silently skip the sound */ }
  }

  // Registered once, lazily, the first time we actually need it — see
  // ensureServiceWorker() below. Populated with the ServiceWorkerRegistration once ready.
  let swRegistration = null;

  // Mobile Chrome/Firefox on Android reject `new Notification(...)` called directly from
  // a page script (it throws "Illegal constructor" — see sw.js for the full explanation)
  // and require ServiceWorkerRegistration.showNotification() instead. Desktop browsers and
  // iOS Safari don't have that restriction (iOS Safari doesn't support the Notification API
  // in a regular browser tab at all, service worker or not — see notes in the fix summary).
  async function ensureServiceWorker() {
    if (swRegistration) return swRegistration;
    if (!('serviceWorker' in navigator)) return null;
    try {
      await navigator.serviceWorker.register('/sw.js');
      // .ready resolves once a worker is actually active for this page — registering
      // alone isn't enough, since the very first registration is briefly "installing".
      swRegistration = await navigator.serviceWorker.ready;
      return swRegistration;
    } catch (e) {
      console.warn('Service worker registration failed — falling back to the plain Notification API where supported.', e);
      return null;
    }
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (!window.isSecureContext) {
      console.warn('Notifications require HTTPS (or localhost). This page is not a secure context, so browser notifications cannot be enabled here.');
      return 'insecure-context';
    }
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Notification.permission;
    }
    // Must be called from a real user gesture (e.g. a click) — modern mobile browsers
    // silently ignore or auto-block permission prompts triggered without one, which was
    // the main reason phones never actually ended up with permission granted.
    return Notification.requestPermission();
  }

  async function showBrowserNotification(payload) {
    if (!('Notification' in window)) return; // e.g. iOS Safari in a regular browser tab
    if (!window.isSecureContext) return; // Notifications require HTTPS/localhost
    if (Notification.permission !== 'granted') return; // don't prompt here — see notifBell handler

    const title = `New order: ${payload.orderNumber}`;
    const options = {
      body: `${payload.customer.name} · ₹${Number(payload.total).toLocaleString('en-IN')}`,
      tag: payload.orderId
    };

    try {
      const registration = await ensureServiceWorker();
      if (registration && registration.showNotification) {
        // The mobile-safe path — works on Android Chrome/Firefox and desktop alike.
        await registration.showNotification(title, options);
      } else {
        // No service worker available (e.g. registration failed) — fall back to the plain
        // constructor, which still works fine on desktop browsers.
        new Notification(title, options);
      }
    } catch (e) {
      // Never let a notification failure break the chime/toast/badge that follow this
      // call in the socket handler.
      console.warn('Could not display a browser notification for this order.', e);
    }
  }

  function showToast(payload) {
    if (!toastStack) return;
    const el = document.createElement('div');
    el.className = 'admin-toast';
    const itemsSummary = (payload.items || []).map((i) => `${i.name} ×${i.qty}`).join(', ');
    el.innerHTML = `
      <button type="button" class="t-close" aria-label="Dismiss">&times;</button>
      <strong>New Order — ${payload.orderNumber}</strong>
      <div class="t-line"><strong>${escapeAdminHtml(payload.customer.name || 'Customer')}</strong> · ${escapeAdminHtml(payload.customer.email || '')}</div>
      <div class="t-line">${escapeAdminHtml(payload.customer.phone || 'No phone on file')}</div>
      <div class="t-line">${escapeAdminHtml(itemsSummary)}</div>
      <div class="t-line">Total: ₹${Number(payload.total).toLocaleString('en-IN')} · ${escapeAdminHtml((payload.paymentMethod || 'cod').toUpperCase())}</div>
    `;
    toastStack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-shown'));

    const dismiss = () => {
      el.classList.remove('is-shown');
      setTimeout(() => el.remove(), 350);
    };
    el.querySelector('.t-close').addEventListener('click', dismiss);
    setTimeout(dismiss, 9000);
  }

  function escapeAdminHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function addToNotifLog(payload) {
    notifLog.unshift(payload);
    unreadCount += 1;
    updateBadge();

    if (notifList) {
      const empty = notifList.querySelector('.admin-notif-empty');
      if (empty) empty.remove();

      const item = document.createElement('div');
      item.className = 'admin-notif-item';
      item.innerHTML = `
        <div class="n-title">${escapeAdminHtml(payload.orderNumber)} — ${escapeAdminHtml(payload.customer.name || 'Customer')}</div>
        <div class="n-meta">₹${Number(payload.total).toLocaleString('en-IN')} · ${escapeAdminHtml(payload.customer.phone || 'no phone')}</div>
        <div class="n-time">${formatDateTime(payload.createdAt)}</div>
      `;
      item.addEventListener('click', () => {
        notifPanel.classList.remove('is-open');
        notifBell.setAttribute('aria-expanded', 'false');
        const card = ordersList.querySelector(`[data-order-id="${payload.orderId}"]`);
        if (card) { card.classList.add('open'); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      });
      notifList.prepend(item);
    }
  }

  function prependOrderToList(payload) {
    // Build a minimal order-shaped object matching what orderCard()/applyFilters() expect,
    // so a brand-new order shows up at the top of the existing list immediately.
    allOrders.unshift({
      _id: payload.orderId,
      orderNumber: payload.orderNumber,
      user: { name: payload.customer.name, email: payload.customer.email, phone: payload.customer.phone },
      shippingAddress: payload.shippingAddress,
      items: payload.items,
      subtotal: payload.subtotal,
      shipping: payload.shipping,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      paymentStatus: payload.paymentStatus,
      status: 'pending',
      createdAt: payload.createdAt
    });
    render();
  }

  function initRealtimeNotifications() {
    // Registering early (rather than waiting for the first order) means the service
    // worker is already active by the time a notification needs to be shown.
    ensureServiceWorker();

    if (typeof io !== 'function') {
      console.warn('Socket.IO client not loaded — real-time notifications are disabled, but the dashboard still works normally.');
      return;
    }

    const socket = io({ withCredentials: true });

    socket.on('new-order', (payload) => {
      playChime();
      showBrowserNotification(payload);
      showToast(payload);
      addToNotifLog(payload);
      prependOrderToList(payload);
    });

    if (notifBell && notifPanel) {
      notifBell.addEventListener('click', (e) => {
        e.stopPropagation();
        // Piggyback the permission prompt on this click — it's the one guaranteed user
        // gesture in this flow, which mobile browsers require before they'll honour a
        // Notification.requestPermission() call at all.
        if ('Notification' in window && Notification.permission === 'default') {
          requestNotificationPermission();
        }
        const isOpen = notifPanel.classList.toggle('is-open');
        notifBell.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) { unreadCount = 0; updateBadge(); }
      });
      document.addEventListener('click', (e) => {
        if (!notifPanel.contains(e.target) && e.target !== notifBell) {
          notifPanel.classList.remove('is-open');
          notifBell.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  init();
})();