const jwt = require('jsonwebtoken');

const REMEMBER_EXPIRY = process.env.JWT_EXPIRES_IN || '30d';
const SESSION_EXPIRY = '1d'; // used when "Remember me" is unchecked — token itself still expires quickly
const REMEMBER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateToken(userId, rememberMe = true) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? REMEMBER_EXPIRY : SESSION_EXPIRY
  });
}

function setAuthCookie(res, token, rememberMe = true) {
  const cookieName = process.env.COOKIE_NAME || 'tt_token';
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };
  // "Remember me" checked -> persists 30 days even after the browser closes.
  // Unchecked -> a session cookie (no maxAge) that the browser discards on close,
  // and the JWT itself is only valid for a day either way.
  if (rememberMe) cookieOptions.maxAge = REMEMBER_MAX_AGE_MS;
  res.cookie(cookieName, token, cookieOptions);
}

function clearAuthCookie(res) {
  const cookieName = process.env.COOKIE_NAME || 'tt_token';
  res.clearCookie(cookieName);
}

module.exports = { generateToken, setAuthCookie, clearAuthCookie };