/* Shop page — mobile filter drawer controller.
   Only opens/closes the existing #shopFilters sidebar as a bottom sheet on
   small screens. All actual filtering (checkboxes, swatches, search, sort)
   is handled by the existing code in main.js — this file never touches
   filter state, only visibility/animation of the drawer.

   Two toolbar buttons trigger the same drawer: #mshopCategoryOpen and
   #mshopFiltersOpen (Category / Filter pills). Both simply reveal
   #shopFilters, whose first group is already "Category" — no separate
   filter logic needed for the Category pill. */
(function () {
  var openBtns = Array.prototype.slice.call(
    document.querySelectorAll('#mshopCategoryOpen, #mshopFiltersOpen')
  );
  var closeBtn = document.getElementById('mshopFiltersClose');
  var applyBtn = document.getElementById('mshopFiltersApply');
  var backdrop = document.getElementById('mshopBackdrop');
  var panel = document.getElementById('shopFilters');

  if (!openBtns.length || !panel || !backdrop) return;

  function openDrawer() {
    panel.classList.add('mshop-open');
    backdrop.hidden = false;
    // next frame so the transition runs
    requestAnimationFrame(function () { backdrop.classList.add('mshop-show'); });
    openBtns.forEach(function (btn) { btn.setAttribute('aria-expanded', 'true'); });
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    panel.classList.remove('mshop-open');
    backdrop.classList.remove('mshop-show');
    openBtns.forEach(function (btn) { btn.setAttribute('aria-expanded', 'false'); });
    document.body.style.overflow = '';
    setTimeout(function () { backdrop.hidden = true; }, 300);
  }

  openBtns.forEach(function (btn) { btn.addEventListener('click', openDrawer); });
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (applyBtn) applyBtn.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('mshop-open')) closeDrawer();
  });

  // If the viewport is resized past the mobile breakpoint while the drawer
  // is open, reset it so it doesn't reappear as a stray fixed panel.
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768 && panel.classList.contains('mshop-open')) {
      closeDrawer();
    }
  });
})();

/* ---------- Product card wishlist/quick-add icons — tap-to-reveal (touch only) ----------
   Desktop keeps the existing hover-to-reveal in style.css untouched — a real mouse can
   hover without clicking, so :hover alone already does this. Touchscreens have no hover
   input at all, so this is the closest equivalent: the FIRST tap on a card's photo reveals
   the icons (matching shop-mobile.css's `@media (hover: none) .pc-actions` override above)
   instead of navigating. Only a further tap on an already-revealed card's photo navigates.
   Runs in the capture phase so it decides the outcome before main.js's own bubble-phase
   "click anywhere on the card navigates" listener ever sees the event — so a button tap
   can never silently fall through to the photo underneath. */
(function () {
  if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return; // real mouse available — desktop hover behaviour in style.css applies as-is
  }

  function collapseAllExcept(exceptCard) {
    document.querySelectorAll('body.page-shop .product-card.pc-touch-revealed').forEach(function (c) {
      if (c !== exceptCard) c.classList.remove('pc-touch-revealed');
    });
  }

  document.addEventListener('click', function (e) {
    var media = e.target.closest('body.page-shop .pc-media');
    if (!media) return;
    if (e.target.closest('[data-wish-toggle], [data-quick-add]')) return; // icon taps work normally
    var card = media.closest('.product-card');
    if (!card) return;

    if (!card.classList.contains('pc-touch-revealed')) {
      e.preventDefault();
      e.stopPropagation();
      collapseAllExcept(card);
      card.classList.add('pc-touch-revealed');
    }
  }, true);

  // Tapping anywhere outside a revealed card's photo collapses it again.
  document.addEventListener('click', function (e) {
    if (e.target.closest('body.page-shop .pc-media')) return; // handled above
    collapseAllExcept(null);
  });
})();