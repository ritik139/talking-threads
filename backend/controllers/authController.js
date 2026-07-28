const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const crypto = require('crypto');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const Newsletter = require('../models/Newsletter');
const { generateToken, setAuthCookie, clearAuthCookie } = require('../utils/generateToken');
const { getGoogleClient } = require('../config/googleClient');

const OAUTH_STATE_COOKIE = 'tt_oauth_state';
const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5000').replace(/\/$/, '');

// @desc   Register a new customer
// @route  POST /api/auth/register
// @access Public
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, newsletterSubscribed } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  const user = await User.create({ name, email, password, newsletterSubscribed: !!newsletterSubscribed });

  // Every user gets an empty cart + wishlist document created up front
  await Cart.create({ user: user._id, items: [] });
  await Wishlist.create({ user: user._id, items: [] });

  if (newsletterSubscribed) {
    await Newsletter.findOneAndUpdate(
      { email: user.email },
      { email: user.email, subscribed: true },
      { upsert: true, new: true }
    );
  }

  const token = generateToken(user._id);
  setAuthCookie(res, token);

  res.status(201).json({
    success: true,
    message: 'Account created — welcome to Talking-Thread.',
    token,
    user: user.toSafeObject()
  });
});

// @desc   Log in
// @route  POST /api/auth/login
// @access Public
exports.login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe = true } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    // Deliberately generic — confirming which part failed would let an attacker enumerate registered emails.
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!user.isActive) throw new ApiError(403, 'This account has been disabled. Please contact support.');

  const token = generateToken(user._id, !!rememberMe);
  setAuthCookie(res, token, !!rememberMe);

  res.json({
    success: true,
    message: 'Signed in successfully.',
    token,
    user: user.toSafeObject()
  });
});

// @desc   Log out (clears the auth cookie)
// @route  POST /api/auth/logout
// @access Public
exports.logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Signed out.' });
});

// @desc   Get the logged-in user's profile
// @route  GET /api/auth/me
// @access Private
exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

// @desc   Update profile (name, phone)
// @route  PUT /api/auth/me
// @access Private
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  res.json({ success: true, user: req.user.toSafeObject() });
});

// @desc   Change password
// @route  PUT /api/auth/change-password
// @access Private
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(401, 'Current password is incorrect.');
  }
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated.' });
});

// @desc   Add a shipping address
// @route  POST /api/auth/addresses
// @access Private
exports.addAddress = asyncHandler(async (req, res) => {
  const address = req.body;
  if (address.isDefault) {
    req.user.addresses.forEach((a) => { a.isDefault = false; });
  }
  req.user.addresses.push(address);
  await req.user.save();
  res.status(201).json({ success: true, addresses: req.user.addresses });
});

// @desc   Delete a shipping address
// @route  DELETE /api/auth/addresses/:addressId
// @access Private
exports.deleteAddress = asyncHandler(async (req, res) => {
  req.user.addresses = req.user.addresses.filter(
    (a) => a._id.toString() !== req.params.addressId
  );
  await req.user.save();
  res.json({ success: true, addresses: req.user.addresses });
});

// @desc   Kick off "Continue with Google" — redirects the browser to Google's consent screen
// @route  GET /api/auth/google
// @access Public
exports.googleAuthStart = asyncHandler(async (req, res) => {
  const google = getGoogleClient(req);
  if (!google) {
    return res.redirect(`${frontendUrl()}/login.html?auth=google_error&message=${encodeURIComponent('Google sign-in is not configured yet.')}`);
  }

  // Random, single-use state value guards the callback against CSRF — stored in a short-lived,
  // httpOnly cookie and compared against what Google sends back.
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000 // 10 minutes is plenty to complete the consent flow
  });

  const authUrl = google.client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state
  });

  res.redirect(authUrl);
});

// @desc   Google redirects back here with an auth code after the user grants consent
// @route  GET /api/auth/google/callback
// @access Public
exports.googleAuthCallback = asyncHandler(async (req, res) => {
  const redirectOnError = (message) =>
    res.redirect(`${frontendUrl()}/login.html?auth=google_error&message=${encodeURIComponent(message)}`);

  const { code, state, error } = req.query;
  res.clearCookie(OAUTH_STATE_COOKIE);

  if (error) return redirectOnError('Google sign-in was cancelled.');
  if (!code) return redirectOnError('Google did not return an authorization code.');

  const cookieState = req.cookies && req.cookies[OAUTH_STATE_COOKIE];
  if (!cookieState || cookieState !== state) {
    return redirectOnError('Your sign-in session expired or is invalid — please try again.');
  }

  const google = getGoogleClient(req);
  if (!google) return redirectOnError('Google sign-in is not configured on this server.');

  let payload;
  try {
    const { tokens } = await google.client.getToken({ code, redirect_uri: google.redirectUri });
    const ticket = await google.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    payload = ticket.getPayload();
  } catch (err) {
    return redirectOnError('Could not verify your Google account. Please try again.');
  }

  if (!payload || !payload.email) return redirectOnError('Google did not share an email address.');
  if (payload.email_verified === false) return redirectOnError('Please verify your email address with Google first.');

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });

  if (user) {
    // Link this Google account to an existing (e.g. email/password) account if not already linked
    if (!user.googleId) {
      user.googleId = payload.sub;
      user.avatar = user.avatar || payload.picture || '';
      await user.save();
    }
  } else {
    user = await User.create({
      name: payload.name || email.split('@')[0],
      email,
      googleId: payload.sub,
      avatar: payload.picture || '',
      authProvider: 'google'
    });
    await Cart.create({ user: user._id, items: [] });
    await Wishlist.create({ user: user._id, items: [] });
  }

  if (!user.isActive) return redirectOnError('This account has been disabled. Please contact support.');

  // From here on, session creation is identical to a normal email/password login
  const token = generateToken(user._id, true);
  setAuthCookie(res, token, true);

  res.redirect(`${frontendUrl()}/index.html?auth=google_success`);
});