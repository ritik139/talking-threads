/* ==========================================================================
   Talking-Thread — First-Visit Welcome Modal
   Shows once per browser on the very first visit, then never again
   (gated on localStorage). Purely additive: builds and injects its own
   markup at runtime and does not touch any existing DOM, CSS class, or
   script on the site.
   ========================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "tt_welcome_seen_v1";
  var SHOW_DELAY_MS = 600;

  /* ---------------- Storage helpers (defensive — private browsing /
     disabled storage should never break the page) ---------------- */
  function hasSeenWelcome() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) {
      return true; // if storage is unavailable, fail safe and don't show
    }
  }
  function markWelcomeSeen() {
    try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch (e) { /* no-op */ }
  }

  function init() {
    if (hasSeenWelcome()) return;

    var lastFocused = document.activeElement;

    var overlay = document.createElement("div");
    overlay.className = "tt-welcome-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "tt-welcome-title");
    overlay.innerHTML =
      '<div class="tt-welcome-card">' +
        '<button type="button" class="tt-welcome-close" aria-label="Close welcome message">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        "</button>" +
        '<div class="tt-welcome-mark" aria-hidden="true">' +
          '<svg viewBox="0 0 26 26" focusable="false">' +
            '<circle cx="13" cy="13" r="9" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
            '<path d="M5.5 13c3.2-4.2 11.8-4.2 15 0" stroke="currentColor" stroke-width="1.3" fill="none" stroke-dasharray="2 2.6" stroke-linecap="round"/>' +
          "</svg>" +
        "</div>" +
        '<span class="tt-welcome-eyebrow">Talking&#8209;Thread</span>' +
        '<h2 id="tt-welcome-title">Welcome to Talking Threads</h2>' +
        '<p class="tt-welcome-tagline">Every stitch tells a story.</p>' +
        '<div class="tt-welcome-rule" aria-hidden="true"></div>' +
        "<p>Designed and handcrafted by Ravina Deora.</p>" +
        '<p class="tt-welcome-thanks">Thank you for supporting handmade artistry.</p>' +
        '<a href="collections.html" class="tt-welcome-cta">Explore Collection</a>' +
        '<button type="button" class="tt-welcome-dismiss">Continue browsing</button>' +
      "</div>";

    document.body.appendChild(overlay);

    var card = overlay.querySelector(".tt-welcome-card");
    var closeBtn = overlay.querySelector(".tt-welcome-close");
    var dismissBtn = overlay.querySelector(".tt-welcome-dismiss");
    var exploreLink = overlay.querySelector(".tt-welcome-cta");

    function open() {
      document.documentElement.classList.add("tt-welcome-lock");
      requestAnimationFrame(function () {
        overlay.classList.add("is-open");
        closeBtn.focus();
      });
      document.addEventListener("keydown", onKeydown, true);
    }

    function close(navigating) {
      markWelcomeSeen();
      overlay.classList.remove("is-open");
      document.documentElement.classList.remove("tt-welcome-lock");
      document.removeEventListener("keydown", onKeydown, true);

      if (navigating) return; // page is about to unload, no need to clean up DOM

      window.setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
      }, 500);
    }

    function onKeydown(e) {
      if (e.key === "Escape" || e.key === "Esc") {
        close(false);
      } else if (e.key === "Tab") {
        // Simple focus trap between the two focusable controls in the modal.
        var focusables = [closeBtn, exploreLink, dismissBtn];
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    closeBtn.addEventListener("click", function () { close(false); });
    dismissBtn.addEventListener("click", function () { close(false); });
    exploreLink.addEventListener("click", function () { close(true); });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close(false);
    });
    card.addEventListener("click", function (e) { e.stopPropagation(); });

    window.setTimeout(open, SHOW_DELAY_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();