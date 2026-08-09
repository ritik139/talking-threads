/*
 * Delivery location picker — Leaflet + OpenStreetMap (no Google Maps, no API key, no billing).
 *
 * Runs only on pages that have a #deliveryMap element (currently cart.html's checkout modal),
 * so it's a complete no-op everywhere else and can never interfere with other pages.
 *
 * Talks to three free, keyless public services:
 *   - OpenStreetMap tile server        → map imagery
 *   - Nominatim (nominatim.openstreetmap.org) → address search + reverse geocoding
 *   - OSRM demo server (router.project-osrm.org) → driving route + distance/duration
 *
 * All three are best-effort, rate-limited public services. If a request fails (offline,
 * rate-limited, etc.) the picker degrades gracefully — the shopper can still fill the
 * address fields in by hand, exactly as before this feature existed.
 */
(function () {
  'use strict';

  const mapEl = document.getElementById('deliveryMap');
  if (!mapEl || typeof L === 'undefined') return; // Not on this page, or Leaflet failed to load.

  // Studio origin — used as the route start point. Kept in sync with the address shown on
  // contact.html / the footer (C-12 Malviya Nagar, Mumbai, Maharashtra 400001, India).
  const STUDIO = { lat: 26.8506, lng: 75.8046 };

  const searchInput = document.getElementById('co-map-search');
  const suggestionsEl = document.getElementById('mapSuggestions');
  const locateBtn = document.getElementById('mapLocateBtn');
  const resultBox = document.getElementById('mapResult');
  const resultAddressEl = document.getElementById('mapResultAddress');
  const resultRouteEl = document.getElementById('mapResultRoute');
  const errorEl = document.getElementById('mapError');

  const latField = document.getElementById('co-lat');
  const lngField = document.getElementById('co-lng');
  const formattedField = document.getElementById('co-formatted-address');
  const line1Field = document.getElementById('co-line1');
  const cityField = document.getElementById('co-city');
  const stateField = document.getElementById('co-state');
  const postalField = document.getElementById('co-postal');
  const countryField = document.getElementById('co-country');

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove('is-hidden');
  }
  function clearError() {
    if (!errorEl) return;
    errorEl.classList.add('is-hidden');
    errorEl.textContent = '';
  }

  // ---------- Map setup ----------
  const map = L.map(mapEl, { scrollWheelZoom: false }).setView([STUDIO.lat, STUDIO.lng], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Leaflet's default marker icons are referenced as relative paths that break when Leaflet
  // is loaded from a CDN — point them at the CDN's own image assets instead.
  const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  const studioIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [20, 33],
    iconAnchor: [10, 33],
    popupAnchor: [1, -28],
    shadowSize: [33, 33],
    className: 'studio-marker-icon'
  });

  L.marker([STUDIO.lat, STUDIO.lng], { icon: studioIcon, interactive: false })
    .addTo(map)
    .bindTooltip('Talking-Thread Studio', { permanent: false, direction: 'top' });

  let deliveryMarker = null;
  let routeLine = null;

  function setDeliveryMarker(lat, lng, { pan = true } = {}) {
    if (deliveryMarker) {
      deliveryMarker.setLatLng([lat, lng]);
    } else {
      deliveryMarker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      deliveryMarker.on('dragend', () => {
        const pos = deliveryMarker.getLatLng();
        onLocationChosen(pos.lat, pos.lng, { pan: false });
      });
    }
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }

  // Map is inside a modal that starts hidden — Leaflet measures the container on init, so
  // sizes come out wrong until the modal is actually visible. Recalculate once it opens.
  const checkoutModal = document.getElementById('checkoutModal');
  if (checkoutModal) {
    const observer = new MutationObserver(() => {
      if (!checkoutModal.classList.contains('is-hidden')) {
        setTimeout(() => map.invalidateSize(), 60);
      }
    });
    observer.observe(checkoutModal, { attributes: true, attributeFilter: ['class'] });
  }

  // ---------- Reverse geocoding (coords -> address) ----------
  async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Reverse geocoding failed');
    return res.json();
  }

  function fillAddressFields(data) {
    const a = (data && data.address) || {};
    const houseStreet = [a.house_number, a.road].filter(Boolean).join(' ');
    const area = a.suburb || a.neighbourhood || a.quarter || '';
    if (line1Field) line1Field.value = houseStreet || area || (data && data.display_name ? data.display_name.split(',')[0] : '');
    if (cityField) cityField.value = a.city || a.town || a.village || a.county || '';
    if (stateField) stateField.value = a.state || '';
    if (postalField) postalField.value = a.postcode || '';
    if (countryField && a.country) countryField.value = a.country;
  }

  // ---------- Routing (OSRM) ----------
  async function fetchRoute(lat, lng) {
    const url = `https://router.project-osrm.org/route/v1/driving/${STUDIO.lng},${STUDIO.lat};${lng},${lat}?overview=full&geometry=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Routing failed');
    const data = await res.json();
    if (!data.routes || !data.routes.length) throw new Error('No route found');
    return data.routes[0];
  }

  function drawRoute(route) {
    if (routeLine) {
      map.removeLayer(routeLine);
      routeLine = null;
    }
    const latlngs = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    routeLine = L.polyline(latlngs, { color: '#8B2E3A', weight: 4, opacity: 0.85 }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
  }

  function formatDistanceDuration(route) {
    const km = (route.distance / 1000).toFixed(1);
    const mins = Math.round(route.duration / 60);
    const durationLabel = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr ${mins % 60} min`;
    return `${km} km from the studio &middot; approx. ${durationLabel} by road`;
  }

  // ---------- Orchestration: called whenever the delivery point changes ----------
  let requestToken = 0;
  async function onLocationChosen(lat, lng, { pan = true } = {}) {
    clearError();
    const myToken = ++requestToken;

    setDeliveryMarker(lat, lng, { pan });
    if (latField) latField.value = lat;
    if (lngField) lngField.value = lng;

    if (resultBox) resultBox.classList.remove('is-hidden');
    if (resultAddressEl) resultAddressEl.textContent = 'Looking up address…';
    if (resultRouteEl) resultRouteEl.textContent = '';

    try {
      const geo = await reverseGeocode(lat, lng);
      if (myToken !== requestToken) return; // A newer selection has superseded this one.
      const address = geo.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (formattedField) formattedField.value = address;
      if (resultAddressEl) resultAddressEl.textContent = address;
      fillAddressFields(geo);
    } catch (err) {
      if (myToken !== requestToken) return;
      if (resultAddressEl) resultAddressEl.textContent = `Pinned at ${lat.toFixed(5)}, ${lng.toFixed(5)} — address lookup unavailable, please fill the fields below manually.`;
      if (formattedField) formattedField.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    try {
      const route = await fetchRoute(lat, lng);
      if (myToken !== requestToken) return;
      drawRoute(route);
      if (resultRouteEl) resultRouteEl.innerHTML = formatDistanceDuration(route);
    } catch (err) {
      if (myToken !== requestToken) return;
      if (resultRouteEl) resultRouteEl.textContent = '';
    }
  }

  // ---------- Click-to-select ----------
  map.on('click', (e) => {
    onLocationChosen(e.latlng.lat, e.latlng.lng);
  });

  // ---------- Current location ----------
  if (locateBtn) {
    locateBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showError('Your browser does not support location detection — please search or click the map instead.');
        return;
      }
      clearError();
      const originalLabel = locateBtn.innerHTML;
      locateBtn.disabled = true;
      locateBtn.textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          locateBtn.disabled = false;
          locateBtn.innerHTML = originalLabel;
          onLocationChosen(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          locateBtn.disabled = false;
          locateBtn.innerHTML = originalLabel;
          showError('Could not get your current location — please allow location access, or search / click the map instead.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // ---------- Address search with suggestions (Nominatim search) ----------
  let searchTimer = null;
  let searchAbort = null;

  function hideSuggestions() {
    if (!suggestionsEl) return;
    suggestionsEl.classList.add('is-hidden');
    suggestionsEl.innerHTML = '';
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderSuggestions(results) {
    if (!suggestionsEl) return;
    if (!results.length) {
      hideSuggestions();
      return;
    }
    suggestionsEl.innerHTML = results
      .map((r, i) => `<li role="option" tabindex="-1" data-idx="${i}">${escapeHtml(r.display_name)}</li>`)
      .join('');
    suggestionsEl.classList.remove('is-hidden');

    Array.from(suggestionsEl.children).forEach((li, i) => {
      li.addEventListener('click', () => {
        const r = results[i];
        if (searchInput) searchInput.value = r.display_name;
        hideSuggestions();
        onLocationChosen(parseFloat(r.lat), parseFloat(r.lon));
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      clearTimeout(searchTimer);
      if (query.length < 3) {
        hideSuggestions();
        return;
      }
      // Debounce to respect Nominatim's usage policy (max ~1 request/second).
      searchTimer = setTimeout(async () => {
        if (searchAbort) searchAbort.abort();
        searchAbort = new AbortController();
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=in&q=${encodeURIComponent(query)}`;
          const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: searchAbort.signal });
          if (!res.ok) throw new Error('Search failed');
          const results = await res.json();
          renderSuggestions(results);
        } catch (err) {
          if (err.name !== 'AbortError') hideSuggestions();
        }
      }, 400);
    });

    searchInput.addEventListener('blur', () => {
      // Slight delay so a click on a suggestion registers before the list disappears.
      setTimeout(hideSuggestions, 150);
    });
  }

  // Reset the picker whenever the checkout modal is reopened, so a leftover pin from a
  // previous session doesn't silently ship to the wrong address.
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      setTimeout(() => map.invalidateSize(), 60);
    });
  }

  // checkoutForm.reset() (called in js/main.js after a successful order) clears the hidden
  // lat/lng/address fields, but the drawn pin + route on the Leaflet map itself would
  // otherwise linger. Clear those too so the next checkout starts from a clean map.
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('reset', () => {
      requestToken++; // Invalidate any in-flight lookups.
      if (deliveryMarker) {
        map.removeLayer(deliveryMarker);
        deliveryMarker = null;
      }
      if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
      map.setView([STUDIO.lat, STUDIO.lng], 13);
      if (resultBox) resultBox.classList.add('is-hidden');
      if (resultAddressEl) resultAddressEl.textContent = '';
      if (resultRouteEl) resultRouteEl.textContent = '';
      clearError();
      hideSuggestions();
      if (searchInput) searchInput.value = '';
    });
  }
})();