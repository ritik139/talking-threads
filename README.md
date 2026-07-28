# Talking-Thread — SEO & Responsive Audit / Cleanup

This is the updated site. The visual design, layout, colors, and every
component's behaviour are unchanged — only the code structure, SEO
tagging, and semantic HTML were improved.

## What changed

### 1. Inline CSS/JS extracted into dedicated folders
- `css/style.css` — one shared stylesheet, linked from all 12 pages
  (previously an identical `<style>` block was duplicated in every file).
- `js/main.js` — one shared script, linked with `defer` from all 12 pages
  (previously an identical `<script>` block was duplicated in every file).
- All 172 one-off `style="..."` attributes scattered through the markup
  were replaced with named CSS classes (e.g. `.section-flush-top`,
  `.cart-note`, `.filter-count`, `.mt-8`) or, for the thread-colour swatch
  dots, a single CSS custom property (`style="--swatch:#C9A24B"`) — the only
  inline styling left, since swatch colours are page content/data, not
  presentation, and there's no way to represent "this dot is this exact hex"
  as a static class without one class per colour per page.

### 2. Responsiveness
Already solid — the shared stylesheet has proper breakpoints (1024px,
860px, 640px, 480px) covering desktop/tablet/mobile, and nothing needed to
change here. Verified this carries over correctly now that the CSS lives
in one external file.

### 3. SEO
- `<link rel="canonical">` on every page
- `<meta name="robots">` — `index, follow` on the 8 public marketing/content
  pages, `noindex, follow` on the 4 account/utility pages (`cart.html`,
  `login.html`, `register.html`, `wishlist.html`) since those are
  user-specific and shouldn't be indexed
- Open Graph + Twitter Card tags on every page
- JSON-LD structured data:
  - `Organization` + `WebSite` on `index.html`
  - `Product` on `product.html`
  - `BlogPosting` on `journal-post.html`
  - `BreadcrumbList` on all 8 pages that show a breadcrumb trail
- `sitemap.xml` — lists the 8 indexable pages
- `robots.txt` — allows crawling, disallows the 4 account/utility pages,
  points to the sitemap
- `favicon.svg` — a lightweight vector favicon reusing the existing logo mark
- Google Fonts moved from a render-blocking CSS `@import` to
  `<link rel="preconnect">` + `<link rel="stylesheet">` in `<head>`, so the
  browser can fetch fonts and CSS in parallel

### 4. Semantic HTML / accessibility
- Every page now has exactly one `<h1>` (six pages — cart, collections,
  contact, journal, shop, wishlist — previously used `<h2>` for their main
  title with no `<h1>` on the page at all)
- Added a `<main id="main-content">` landmark around each page's content,
  plus a "Skip to content" link for keyboard/screen-reader users
- Breadcrumbs converted from plain `<div>`/`<span>` into a proper
  `<nav aria-label="Breadcrumb"><ol>…</ol></nav>` with `aria-current="page"`
  on the current step

## Action items before going live

1. **Replace the placeholder domain.** Every canonical tag, Open Graph URL,
   `sitemap.xml`, and `robots.txt` currently uses
   `https://www.talking-thread.com` as a placeholder. Find-and-replace this
   with your real production domain everywhere.

2. **Add real photography.** No image assets were included in the uploaded
   project — every image slot is a placeholder box. Look for HTML comments
   like:
   ```html
   <!-- Replace above with: <img src="images/your-photo.jpg" alt="Hero Banner Image"> -->
   ```
   directly beneath each placeholder `<div class="img-placeholder">`. Drop
   your photos into the `images/` folder and swap in the suggested `<img>`
   tag (the alt text is already written for you). Once real photos are in
   place, also update `og:image` in each page's `<head>` to point at a real
   image (ideally 1200×630) instead of the placeholder
   `images/og-cover.jpg`.

3. **Spot-check in a real browser.** I validated every page against a strict
   HTML5 parser (all 12 pass with no errors) and confirmed CSS/JS syntax is
   valid, but this environment couldn't launch a full browser to visually
   confirm rendering. A quick click-through — especially the cart/wishlist
   add-to-bag flows, which rely on `js/main.js` — is worth doing once you
   have the files locally.
