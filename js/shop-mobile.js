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