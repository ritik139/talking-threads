const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/paymentController');

const router = express.Router();

// Online (Razorpay) checkout — the "Pay Online" option on cart.html's checkout modal.
router.post('/razorpay/order', protect, ctrl.createRazorpayOrder);
router.post('/razorpay/verify', protect, ctrl.verifyRazorpayPayment);
router.post('/razorpay/failed', protect, ctrl.markRazorpayPaymentFailed);

// Razorpay calls this directly (server-to-server) — no user session, authenticated instead
// via the X-Razorpay-Signature header inside the controller.
router.post('/razorpay/webhook', ctrl.razorpayWebhook);

module.exports = router;