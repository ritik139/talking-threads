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

// ---- HTTP server + Socket.IO (real-time "New Order" admin notifications) ----
// Wrapping the Express app in a plain http.Server is required for Socket.IO to attach —
// nothing about how Express itself serves requests changes.
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }
});

function parseCookies(cookieHeader) {
  const out = {};
  (cookieHeader || '').split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}

// Every socket connection is authenticated the same way as a normal API request — via the
// httpOnly JWT cookie — and only accounts with role "admin" are allowed to join the room
// that receives new-order events. Everyone else is disconnected immediately.
io.use(async (socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const cookieName = process.env.COOKIE_NAME || 'tt_token';
    const token = cookies[cookieName];
    if (!token) return next(new Error('Unauthorized'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.role !== 'admin') return next(new Error('Forbidden'));

    socket.data.adminId = user._id.toString();
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
      // allow same-origin/non-browser requests (no origin header) and any configured origin
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
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
app.use(express.static(FRONTEND_DIR, { extensions: ['html'] }));

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