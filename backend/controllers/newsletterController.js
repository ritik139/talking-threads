const asyncHandler = require('../utils/asyncHandler');
const Newsletter = require('../models/Newsletter');
const { sendNewsletterSubscriberEmail } = require('../utils/mailer');

// @desc   Subscribe to the studio newsletter (index.html newsletter-band form)
// @route  POST /api/newsletter
// @access Public
exports.subscribe = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase();

  // includeResultMetadata:true lets us tell an upsert-insert (brand-new subscriber) apart
  // from an update to an existing row (repeat/re-subscribe) via lastErrorObject.upserted —
  // so the admin only gets one notification email per genuinely new sign-up, not on every
  // click. NOTE: this option was called `rawResult` in older Mongoose versions; Mongoose 7+
  // renamed it to `includeResultMetadata` and silently ignores the old name (no error, it
  // just falls back to returning the plain document) — so passing the old name here made
  // `isNewSubscriber` always resolve to false and silently killed this email for everyone.
  const result = await Newsletter.findOneAndUpdate(
    { email: normalizedEmail },
    { email: normalizedEmail, subscribed: true },
    { upsert: true, new: true, setDefaultsOnInsert: true, includeResultMetadata: true }
  );
  const isNewSubscriber = Boolean(result.lastErrorObject && result.lastErrorObject.upserted);

  // Fire-and-forget, same pattern as sendNewOrderEmail in orderController.js — a failed/slow
  // send must never block or fail the subscribe request itself.
  if (isNewSubscriber) {
    sendNewsletterSubscriberEmail({ email: normalizedEmail }).catch((err) => {
      console.error(`New subscriber email failed for ${normalizedEmail}:`, err.message);
    });
  }

  res.status(201).json({
    success: true,
    message: 'Thank you for subscribing — welcome to Talking-Thread.'
  });
});

// @desc   Unsubscribe
// @route  POST /api/newsletter/unsubscribe
// @access Public
exports.unsubscribe = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await Newsletter.findOneAndUpdate({ email: email.toLowerCase() }, { subscribed: false });
  res.json({ success: true, message: 'You have been unsubscribed.' });
});

// @desc   List subscribers
// @route  GET /api/newsletter
// @access Private/Admin
exports.getSubscribers = asyncHandler(async (req, res) => {
  const subscribers = await Newsletter.find({ subscribed: true }).sort('-createdAt').lean();
  res.json({ success: true, count: subscribers.length, subscribers });
});