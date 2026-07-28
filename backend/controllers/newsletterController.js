const asyncHandler = require('../utils/asyncHandler');
const Newsletter = require('../models/Newsletter');

// @desc   Subscribe to the studio newsletter (index.html newsletter-band form)
// @route  POST /api/newsletter
// @access Public
exports.subscribe = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await Newsletter.findOneAndUpdate(
    { email: email.toLowerCase() },
    { email: email.toLowerCase(), subscribed: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
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
  const subscribers = await Newsletter.find({ subscribed: true }).sort('-createdAt');
  res.json({ success: true, count: subscribers.length, subscribers });
});
