const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const razorpay = require('../config/razorpay');
const {
  generateOrderNumber,
  pricedItemsFromCart,
  assertValidShippingAddress,
  notifyNewOrder
} = require('./orderController');

// Compares two hex strings in constant time, without throwing if lengths differ
// (crypto.timingSafeEqual throws on a length mismatch, which itself leaks info via timing).
function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a || ''), 'hex');
  const bufB = Buffer.from(String(b || ''), 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// @desc   Step 1 of online checkout — price the cart, create a local Order (unpaid) and a
//         matching Razorpay order, and hand the frontend what it needs to open Razorpay Checkout.
// @route  POST /api/payments/razorpay/order
// @access Private
exports.createRazorpayOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, notes } = req.body;
  assertValidShippingAddress(shippingAddress);

  const { orderItems, subtotal, shipping, total } = await pricedItemsFromCart(req.user._id);
  // Razorpay order amounts are in the smallest currency unit (paise for INR).
  const amountPaise = Math.round(total * 100);
  if (amountPaise < 100) throw new ApiError(400, 'Order total is too small to pay online.');

  // Cart is intentionally NOT cleared here — it's only cleared once payment is verified,
  // so a payment that's abandoned or fails doesn't silently lose the customer's bag.
  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: req.user._id,
    items: orderItems,
    subtotal,
    shipping,
    total,
    shippingAddress,
    paymentMethod: 'razorpay',
    paymentStatus: 'pending',
    notes
  });

  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { orderId: order._id.toString(), orderNumber: order.orderNumber }
    });
  } catch (err) {
    // Don't leave an unpaid, un-payable order sitting in the database if Razorpay itself
    // couldn't be reached/rejected the request.
    await Order.deleteOne({ _id: order._id });
    console.error('Razorpay order creation failed:', err.message || err);
    throw new ApiError(502, 'Could not start the payment right now — please try again.');
  }

  order.razorpay.orderId = razorpayOrder.id;
  await order.save();

  res.status(201).json({
    success: true,
    orderId: order._id,
    orderNumber: order.orderNumber,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    razorpayOrderId: razorpayOrder.id,
    keyId: process.env.RAZORPAY_KEY_ID
  });
});

// @desc   Step 2 of online checkout — verify the signature Razorpay Checkout returns in its
//         success handler, then mark the order paid and clear the cart.
// @route  POST /api/payments/razorpay/verify
// @access Private
exports.verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new ApiError(400, 'Missing payment verification details.');
  }

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You do not have access to this order.');
  }
  if (order.razorpay.orderId !== razorpayOrderId) {
    throw new ApiError(400, 'This payment does not match this order.');
  }

  // Idempotent: Checkout's handler and the webhook can both race to confirm the same
  // payment — if it's already paid, just return it rather than re-verifying/re-notifying.
  if (order.paymentStatus === 'paid') {
    return res.json({ success: true, message: 'Payment already verified.', order });
  }

  // This HMAC check is the actual proof that the payment happened and wasn't spoofed by
  // the browser — Razorpay signs order_id + "|" + payment_id with your key secret, and
  // only Razorpay's servers and yours know that secret.
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (!safeEqualHex(expectedSignature, razorpaySignature)) {
    order.paymentStatus = 'failed';
    await order.save();
    throw new ApiError(400, 'Payment verification failed — signature mismatch.');
  }

  order.paymentStatus = 'paid';
  order.status = 'confirmed';
  order.razorpay.paymentId = razorpayPaymentId;
  order.razorpay.signature = razorpaySignature;
  await order.save();

  const cart = await Cart.findOne({ user: req.user._id });
  if (cart && cart.items.length) {
    cart.items = [];
    await cart.save();
  }

  // Same "new order" studio email + admin-dashboard socket push that COD orders get —
  // just fired here instead, once money has actually been received.
  notifyNewOrder(req.app.get('io'), order, { name: req.user.name, email: req.user.email });

  res.json({
    success: true,
    message: `Payment verified — order ${order.orderNumber} confirmed.`,
    order
  });
});

// @desc   Called by the frontend when Razorpay Checkout's own "payment.failed" event fires,
//         or when the user dismisses the widget — lets the order (and admin dashboard)
//         reflect a failed attempt instead of sitting silently as "pending" forever.
// @route  POST /api/payments/razorpay/failed
// @access Private
exports.markRazorpayPaymentFailed = asyncHandler(async (req, res) => {
  const { orderId, reason } = req.body;
  if (!orderId) throw new ApiError(400, 'orderId is required.');

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You do not have access to this order.');
  }

  if (order.paymentStatus !== 'paid') {
    order.paymentStatus = 'failed';
    if (reason) {
      const note = `Payment attempt failed: ${String(reason).slice(0, 200)}`;
      order.notes = order.notes ? `${order.notes} | ${note}` : note;
    }
    await order.save();
  }

  res.json({ success: true, order });
});

// @desc   Razorpay server-to-server webhook — the safety net that confirms payment even if
//         the customer closes the tab right after paying, before the Checkout success
//         handler's own verify call (above) can run. Configure this URL + a webhook secret
//         at https://dashboard.razorpay.com/app/webhooks, subscribed to "payment.captured".
// @route  POST /api/payments/razorpay/webhook
// @access Public (authenticated via the X-Razorpay-Signature header instead of a user session)
exports.razorpayWebhook = asyncHandler(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Not configured — safe to no-op rather than 500, since the Checkout-side verify call
    // above still covers the common case.
    return res.status(200).json({ received: true });
  }

  const signature = req.headers['x-razorpay-signature'];
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.alloc(0)).digest('hex');
  if (!signature || !safeEqualHex(expected, signature)) {
    return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
  }

  const event = req.body || {};
  const paymentEntity = event.payload && event.payload.payment && event.payload.payment.entity;

  if ((event.event === 'payment.captured' || event.event === 'order.paid') && paymentEntity) {
    const order = await Order.findOne({ 'razorpay.orderId': paymentEntity.order_id });
    if (order && order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.status = order.status === 'pending' ? 'confirmed' : order.status;
      order.razorpay.paymentId = paymentEntity.id;
      await order.save();

      const cart = await Cart.findOne({ user: order.user });
      if (cart && cart.items.length) {
        cart.items = [];
        await cart.save();
      }

      const user = await User.findById(order.user);
      notifyNewOrder(req.app.get('io'), order, {
        name: user ? user.name : order.shippingAddress.fullName,
        email: user ? user.email : ''
      });
    }
  }

  // Always 200 a well-signed webhook so Razorpay doesn't keep retrying it.
  res.status(200).json({ received: true });
});