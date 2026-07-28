# Talking-Thread — Node.js / Express / MongoDB Backend

This adds a full backend to the existing Talking-Thread static site. **No HTML or CSS
was changed** — every page looks and behaves exactly as before. `js/main.js` was
extended (not rewritten) so the same cart/wishlist/forms now talk to a real API and
MongoDB instead of only `localStorage`.

## What's new

```
talking-thread/
├── (all original .html/.css files — untouched)
├── js/main.js              ← extended, not replaced (see "Frontend changes" below)
└── backend/
    ├── server.js            Express app entry point
    ├── config/db.js          MongoDB connection
    ├── models/                Mongoose schemas
    ├── controllers/           Route handlers / business logic
    ├── routes/                 Express routers
    ├── middleware/             Auth (JWT), validation, error handling
    ├── seed/seed.js            Populates the DB with the real product catalog
    ├── .env.example
    └── package.json
```

## 1. Setup

```bash
cd backend
cp .env.example .env      # then edit .env (Mongo URI, JWT secret, admin bootstrap creds)
npm install
```

You need a MongoDB instance — either:
- Local: install MongoDB Community Server and use `mongodb://127.0.0.1:27017/talking_thread`, or
- Free hosted: create a free cluster at MongoDB Atlas and paste its connection string into `MONGO_URI`.

## 2. Seed the database

Populates the 9 products already referenced in `shop.html`/`product.html` (same names
and prices), a sample journal post, and bootstraps one admin account from your `.env`.

```bash
npm run seed
```

Re-running it is safe (it upserts by name/email, no duplicates). `npm run seed:destroy`
wipes products/journal posts/admin users if you want to start over.

## 3. Run it

```bash
npm run dev      # nodemon, auto-restarts on change
# or
npm start
```

The server serves the API **and** the existing static site from the same port, e.g.
`http://localhost:5000`. Open that URL — it's the exact same site, now backed by MongoDB.

## Frontend changes (what actually changed in `js/main.js`)

Nothing about the DOM, CSS, or visual behavior changed. What was added:

- A small `apiRequest()` fetch wrapper and a `TTAuth` module (login/register/logout,
  exposed as `window.TTAuth` the same way the cart is exposed as `window.TTStore`).
- `Store.addToCart/removeFromCart/updateCartQty/toggleWishlist` still update
  `localStorage` synchronously (exactly as before, so every existing render function
  keeps working untouched) and now **also** push that change to the backend in the
  background when someone is signed in.
- The four `data-demo-form` forms (login, register, contact, newsletter) that used to
  just show a toast and reset now actually call the API. Any other demo form keeps the
  original harmless no-op behavior.
- The cart page's "Proceed to Checkout" button now creates a real order via
  `POST /api/orders` (falls back to prompting sign-in if you're a guest) instead of
  showing "Checkout is coming soon."
- On login/register, whatever was in the guest (localStorage) cart/wishlist is merged
  into the account's server-side cart/wishlist, and on every page load while signed in,
  local storage is refreshed from the server — so a signed-in customer sees the same
  bag/wishlist on any device/browser.
- The existing "Account" icon/link now signs you out (instead of navigating to
  `login.html`) if you're already signed in — no markup was added, just a click handler.

## API reference

All endpoints are under `/api`. Auth uses an httpOnly JWT cookie (also returned in the
JSON body as `token` if you'd rather use `Authorization: Bearer <token>` from a non-browser client).

| Area | Endpoint | Method | Access |
|---|---|---|---|
| Auth | `/api/auth/register` | POST | Public |
| | `/api/auth/login` | POST | Public |
| | `/api/auth/logout` | POST | Public |
| | `/api/auth/me` | GET / PUT | Private |
| | `/api/auth/change-password` | PUT | Private |
| | `/api/auth/addresses` | POST | Private |
| | `/api/auth/addresses/:addressId` | DELETE | Private |
| Products | `/api/products` | GET (search/filter/paginate: `q`, `category`, `minPrice`, `maxPrice`, `isFeatured`, `isBestSeller`, `sort`, `page`, `limit`) | Public |
| | `/api/products/:idOrSlug` | GET | Public |
| | `/api/products/:idOrSlug/related` | GET | Public |
| | `/api/products` | POST | Admin |
| | `/api/products/:id` | PUT / DELETE | Admin |
| Reviews | `/api/products/:productId/reviews` | GET / POST | Public / Private |
| | `/api/products/:productId/reviews/:reviewId` | DELETE | Private (own) / Admin |
| Cart | `/api/cart` | GET / POST / PUT / DELETE | Private |
| | `/api/cart/merge` | POST | Private |
| | `/api/cart/:itemId` | PATCH / DELETE | Private |
| Wishlist | `/api/wishlist` | GET | Private |
| | `/api/wishlist/toggle` | POST | Private |
| | `/api/wishlist/merge` | POST | Private |
| | `/api/wishlist/:index` | DELETE | Private |
| Orders | `/api/orders` | GET / POST | Private |
| | `/api/orders/:id` | GET | Private |
| | `/api/orders/admin/all` | GET | Admin |
| | `/api/orders/:id/status` | PUT | Admin |
| Contact | `/api/contact` | POST | Public |
| | `/api/contact` | GET | Admin |
| | `/api/contact/:id` | PUT | Admin |
| Newsletter | `/api/newsletter` | POST / unsubscribe: `/api/newsletter/unsubscribe` POST | Public |
| | `/api/newsletter` | GET | Admin |
| Journal | `/api/journal` | GET | Public |
| | `/api/journal/:slug` | GET | Public |
| | `/api/journal` | POST | Admin |
| | `/api/journal/:id` | PUT / DELETE | Admin |
| Health | `/api/health` | GET | Public |

## Extra functionality beyond the original static demo

- Real authentication (bcrypt-hashed passwords, JWT in an httpOnly cookie, rate-limited login/register)
- Server-persisted cart, wishlist, and order history — no longer wiped when you clear your browser
- A checkout flow that creates real orders with an auto-generated order number, subtotal/shipping/total
- Product reviews & ratings (not in the original static UI, available via API for future use)
- Admin-only product, journal, contact-message, and order-status management endpoints
- Contact form submissions and newsletter sign-ups are saved (previously discarded)
- Product search, category/price filtering, and pagination via query params
- Centralized validation and error handling, security headers (helmet), and CORS/rate limiting

## Notes / next steps

- Set a strong `JWT_SECRET` and change the seeded admin password before going live.
- The original `README.md`'s action items (replace placeholder domain, add real photos)
  still apply and are unrelated to this backend work.
- There's no admin UI included — admin endpoints are ready for you to build a small
  dashboard against, or manage via a tool like Postman/Insomnia for now.
