/* ==========================================================================
   Talking-Thread — Product page order-summary mirror
   Purely presentational: reads the price main.js already rendered into
   .pd-price-row and the quantity already tracked by .qty-stepper input,
   and mirrors them into the new .pd-summary box (Unit Price / Subtotal).
   Does not add, remove, or alter any add-to-cart / wishlist / product
   fetch behaviour — main.js is untouched and remains the single source
   of truth for cart/product logic.
   ========================================================================== */
(function () {
  function parsePrice(str) {
    if (!str) return 0;
    const n = String(str).replace(/[^\d.]/g, '');
    return parseFloat(n) || 0;
  }
  function formatINR(n) {
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }
  function update() {
    const priceEl = document.querySelector('.pd-price-row span');
    const qtyEl = document.querySelector('.qty-stepper input');
    const unitEl = document.querySelector('.pd-summary-unit');
    const subEl = document.querySelector('.pd-summary-subtotal');
    if (!priceEl || !qtyEl || !unitEl || !subEl) return;
    const unit = parsePrice(priceEl.textContent);
    const qty = parseInt(qtyEl.value, 10) || 1;
    unitEl.textContent = formatINR(unit);
    subEl.textContent = formatINR(unit * qty);
  }

  document.addEventListener('DOMContentLoaded', function () {
    update();

    // Quantity stepper buttons already update the input's value in main.js;
    // just re-read it afterwards to refresh the mirrored subtotal.
    document.querySelectorAll('.qty-stepper button').forEach(function (btn) {
      btn.addEventListener('click', function () { setTimeout(update, 0); });
    });

    // The real price is filled in asynchronously once the product fetch in
    // main.js resolves — observe .pd-price-row for that content change
    // instead of guessing a timeout.
    const priceRow = document.querySelector('.pd-price-row');
    if (priceRow && window.MutationObserver) {
      new MutationObserver(update).observe(priceRow, { childList: true, subtree: true, characterData: true });
    }
  });
})();
