/* Shop page — desktop "grid / list" view toggle.
   Purely a presentational layout switch for #productGrid (adds/removes the
   .is-list-view class). Never reads or writes filter/sort/search state, and
   never touches product data — main.js remains the single source of truth
   for what renders inside the grid. Safe to remove without affecting any
   other feature. */
(function () {
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.view-toggle-btn'));
  var grid = document.getElementById('productGrid');
  if (!buttons.length || !grid) return;

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      grid.classList.toggle('is-list-view', btn.getAttribute('data-view') === 'list');
    });
  });
})();