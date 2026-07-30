require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { verifyMailer } = require('./utils/mailer');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const orderRoutes = require('./routes/orderRoutes');
const contactRoutes = require('./routes/contactRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const journalRoutes = require('./routes/journalRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

const app = express();

connectDB();

// ---- Security & parsing middleware ----
app.use(
  helmet({
    contentSecurityPolicy: false // the existing static pages load Google Fonts etc.; keep this simple/off for now
  })
);

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

// NOTE: The admin-role auth check that used to gate this socket connection has been
// removed — the admin dashboard (and its real-time "New Order" notifications) no longer
// requires sign-in. Every connecting socket is joined to the 'admins' room directly.
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

app.use(express.json({ limit: '1mb' }));
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

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/reviews', reviewRoutes);

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

app.use(express.static(FRONTEND_DIR, { extensions: ['html'], dotfiles: 'ignore' }));

// Any non-API route falls back to the matching HTML file, or index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'), (err) => {
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