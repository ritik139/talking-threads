const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

function extractToken(req) {
  const cookieName = process.env.COOKIE_NAME || 'tt_token';
  if (req.cookies && req.cookies[cookieName]) return req.cookies[cookieName];
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.split(' ')[1];
  return null;
}

// Requires a valid logged-in user
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw new ApiError(401, 'Not authorized — please sign in.');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new ApiError(401, 'Session expired or invalid — please sign in again.');
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled.');

  req.user = user;
  next();
});

// Attaches req.user if a valid token is present, but never blocks the request (used for guest+logged-in parity)
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.isActive) req.user = user;
  } catch (err) {
    // ignore invalid token for optional auth
  }
  next();
});

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ApiError(403, 'Admins only.'));
  }
  next();
};

// Guards the static admin-dashboard.html page itself (as opposed to its API calls).
// Unlike `protect`/`adminOnly`, this never renders a JSON error — a browser navigating
// straight to the page should just be sent to the admin sign-in screen instead.
const adminPageGuard = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.redirect('/admin-login.html');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.redirect('/admin-login.html');
  }

  try {
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.role !== 'admin') {
      return res.redirect('/admin-login.html');
    }
    req.user = user;
    next();
  } catch (err) {
    return res.redirect('/admin-login.html');
  }
};

module.exports = { protect, optionalAuth, adminOnly, adminPageGuard };