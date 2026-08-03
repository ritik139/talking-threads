const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Contact = require('../models/Contact');
const { sendContactEmail } = require('../utils/mailer');

// @desc   Submit the contact form (contact.html)
// @route  POST /api/contact
// @access Public
exports.submitContact = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Save the enquiry first so it's never lost, even if the email fails to send
  const entry = await Contact.create({ name, email, subject, message });

  try {
    await sendContactEmail({ name, email, subject, message });
  } catch (err) {
    console.error('Contact email send failed:', err.message);
    throw new ApiError(502, 'Your message was saved, but we could not email it just now. Please try again in a moment, or reach us directly by phone.');
  }

  res.status(201).json({
    success: true,
    message: 'Message sent — thank you, the studio will reply within two business days.',
    id: entry._id
  });
});

// @desc   List contact messages
// @route  GET /api/contact
// @access Private/Admin
exports.getMessages = asyncHandler(async (req, res) => {
  const messages = await Contact.find().sort('-createdAt').lean();
  res.json({ success: true, count: messages.length, messages });
});

// @desc   Update a message's status (new / read / replied)
// @route  PUT /api/contact/:id
// @access Private/Admin
exports.updateMessageStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const entry = await Contact.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
  if (!entry) throw new ApiError(404, 'Message not found.');
  res.json({ success: true, message: entry });
});