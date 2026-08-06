require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { verifyMailer } = require('./utils/mailer');
const { adminPageGuard } = require('./middleware/auth');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const contactRoutes = require('./routes/contactRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

connectDB();

// ---- Security & parsing middleware ----
app.use(
  helmet({
    contentSecurityPolicy: false // the existing static pages load Google Fonts etc.; keep this simple/off for now
  })
);

// PERF: gzip/deflate-compress responses (JSON API payloads + the static HTML/CSS/JS bundle).
// Pure transport-level change — same bytes decompressed client-side, so no observable
// difference to any API consumer or page; lowers bandwidth and per-request latency under load.
app.use(compression());

const allowedOrigins = (process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  // SECURITY: previously, an empty allowlist meant "allow any origin" — combined with
  // credentials:true (below and in the Socket.IO config) that let ANY website read
  // authenticated responses using a visitor's cookies. Fail closed instead: with no
  // CLIENT_ORIGINS configured, only same-origin/no-origin requests are allowed.
  console.warn(
    'CLIENT_ORIGINS is not set — cross-origin requests with credentials will be rejected. ' +
    'Set CLIENT_ORIGINS (comma-separated) if the frontend is served from a different origin.'
  );
}

function isOriginAllowed(origin) {
  if (!origin) return true; // same-origin / non-browser requests carry no Origin header
  return allowedOrigins.includes(origin);
}

// ---- HTTP server + Socket.IO (real-time "New Order" admin notifications) ----
// Wrapping the Express app in a plain http.Server is required for Socket.IO to attach —
// nothing about how Express itself serves requests changes.
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }
});

// Only a signed-in admin's socket may join the 'admins' room (which receives real-time
// "New Order" notifications) — verified from the same auth cookie/JWT used everywhere
// else, since the socket handshake doesn't go through cookieParser/protect itself.
io.use(async (socket, next) => {
  try {
    const cookieName = process.env.COOKIE_NAME || 'tt_token';
    const rawCookies = socket.handshake.headers.cookie || '';
    const parsedCookies = cookie.parse(rawCookies);
    const token = parsedCookies[cookieName];
    if (!token) return next(new Error('Unauthorized'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.role !== 'admin') return next(new Error('Unauthorized'));

    next();
  } catch (err) {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  socket.join('admins');
});

// Controllers reach the socket server via req.app.get('io') — see orderController.createOrder
app.set('io', io);

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

// `verify` stashes the exact raw bytes of the body on req.rawBody — needed only by the
// Razorpay webhook (backend/controllers/paymentController.js#razorpayWebhook), which must
// HMAC the *raw* JSON to check X-Razorpay-Signature; re-serializing the parsed object can
// produce different bytes (key order, spacing) and would make a legitimate webhook fail.
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Basic rate limiting on the whole API to slow down abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// Tighter limiter specifically on auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts — please try again later.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Chat calls the Gemini API (real cost per call) — cap per IP separately from the general limiter.
const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "I'm getting a lot of questions right now — please try again in a few minutes." }
});
app.use('/api/chat', chatLimiter);

// API responses are dynamic (product catalog, cart, orders, etc.) and must never be served
// from a stale copy by the browser's HTTP cache or an intermediary/CDN cache sitting in front
// of this server. Express sets no Cache-Control on res.json() by default, which is usually
// harmless — but "no header" is not the same as "don't cache": nothing here actively PREVENTS
// a shared cache in front of the app (a CDN, a corporate proxy, etc.) from applying its own
// default caching rules to a GET request. That's a plausible explanation for a symptom like
// "the Shop page briefly shows the current catalog, then reverts to an older one a moment
// later" — a second, slightly slower response for the exact same request arriving from a
// cache that hadn't picked up the latest write yet. Marking every /api response no-store
// removes that ambiguity outright.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Talking-Thread API is running.' });
});

// ---- Serve the existing static frontend (unchanged HTML/CSS/JS) ----
const FRONTEND_DIR = path.join(__dirname, '..');
const BACKEND_DIR = path.resolve(__dirname);

// SECURITY: FRONTEND_DIR is the parent of this backend folder, so without this guard
// express.static below would also serve the entire backend source tree — controllers,
// models, config (including anything not filtered by dotfile rules), routes, this very
// file — to any unauthenticated request that guesses the path (e.g. GET /backend/config/db.js).
// This blocks any request that resolves inside the backend directory itself, independent
// of what that folder happens to be named, and normalizes '..' before comparing so it
// also catches path-traversal attempts.
app.use((req, res, next) => {
  const resolved = path.resolve(FRONTEND_DIR, '.' + req.path);
  if (resolved === BACKEND_DIR || resolved.startsWith(BACKEND_DIR + path.sep)) {
    return res.status(404).end();
  }
  next();
});

// Guard the admin dashboard page itself — a browser navigating straight to
// /admin-dashboard.html without a valid admin session is redirected to sign in.
app.get('/admin-dashboard.html', adminPageGuard, (req, res, next) => {
  res.sendFile(path.join(FRONTEND_DIR, 'admin-dashboard.html'), (err) => {
    if (err) next(err);
  });
});

// PERF: every reference to an image/CSS/JS file in the HTML is cache-busted with a
// `?v=YYYYMMDD` query string (see index.html, shop.html, etc.), so the content at a given
// URL never changes silently — a real change always ships as a new URL. Without telling
// browsers that, express.static's default `Cache-Control: public, max-age=0` forces a
// revalidation round trip (conditional GET) to this server for every single image on
// every repeat view, which is why images that are reused across pages (2.jpg, 3.jpg,
// 4.jpg, 6.jpg, 14.jpg, etc.) were re-requested from the network instead of loading
// instantly from the browser's disk cache. Marking these directories long-lived +
// immutable removes that unnecessary round trip; a version bump still busts the cache
// immediately because it's a different URL. HTML pages themselves are untouched (still
// served below with the original no-cache-by-default behavior) since they aren't
// version-tagged and must keep revalidating normally.
const versionedAssetCache = { maxAge: '365d', immutable: true, dotfiles: 'ignore' };
app.use('/images', express.static(path.join(FRONTEND_DIR, 'images'), versionedAssetCache));
app.use('/css', express.static(path.join(FRONTEND_DIR, 'css'), versionedAssetCache));
app.use('/js', express.static(path.join(FRONTEND_DIR, 'js'), versionedAssetCache));
app.use('/videos', express.static(path.join(FRONTEND_DIR, 'videos'), versionedAssetCache));

app.use(express.static(FRONTEND_DIR, { extensions: ['html'], dotfiles: 'ignore' }));

// Any non-API route that didn't match a real file above is an unknown page —
// serve the branded 404 page with an actual 404 status (previously this fell
// back to index.html, so bad/mistyped URLs silently looked like the homepage).
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.status(404).sendFile(path.join(FRONTEND_DIR, '404.html'), (err) => {
    if (err) next(err);
  });
});

// ---- 404 + error handling for anything under /api that didn't match ----
app.use('/api', notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Talking-Thread server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  verifyMailer();
});

module.exports = app;

// true