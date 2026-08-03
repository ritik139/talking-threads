const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const { sendNewOrderEmail, sendOrderConfirmationEmail } = require('../utils/mailer');

function generateOrderNumber() {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TT-${Date.now().toString().slice(-6)}-${rand}`;
}

const REQUIRED_ADDRESS_FIELDS = ['fullName', 'phone', 'line1', 'city', 'state', 'postalCode', 'country'];

// Shared by createOrder (COD) and paymentController.createRazorpayOrder (online payment) —
// re-prices every cart line against the live Product record instead of trusting whatever
// price is sitting in the cart, since the cart's stored price is client-supplied (see
// cartController.addToCart) and must never be treated as authoritative at checkout.
//
// SECURITY FIX: a cart line with no linked `product` used to fall back to whatever
// name/price the client had originally POSTed for that line — i.e. exactly the
// client-supplied value this whole function exists to NOT trust. `product` is an
// optional field on POST /api/cart, so this was trivially triggerable by any signed-in
// user (omit the field, or send any name/price) to check out — COD or Razorpay, since
// both flows share this function — at whatever price they chose, including ₹0. Every
// real add-to-cart path now sends the catalog product's id (see js/main.js), so a line
// with no `product` reference can no longer be priced at all; it's rejected instead of
// trusted.
async function pricedItemsFromCart(userId) {
  const cart = await Cart.findOne({ user: userId });
  if (!cart || !cart.items.length) throw new ApiError(400, 'Your bag is empty.');

  const productIds = cart.items.filter((i) => i.product).map((i) => i.product);
  const products = productIds.length ? await Product.find({ _id: { $in: productIds } }) : [];
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  const orderItems = cart.items.map((i) => {
    if (!i.product) {
      throw new ApiError(
        400,
        `"${i.name || 'One of the items'}" in your bag could not be verified — please remove and re-add it before checking out.`
      );
    }
    const product = productById.get(i.product.toString());
    if (!product) {
      throw new ApiError(400, `"${i.name || 'One of the items'}" is no longer available.`);
    }
    if (!product.isActive) throw new ApiError(400, `"${product.name}" is no longer available.`);
    return {
      product: product._id,
      name: product.name,
      price: product.displayPrice,
      priceValue: product.price,
      size: i.size,
      color: i.color,
      text: i.text,
      qty: i.qty
    };
  });

  const subtotal = orderItems.reduce((sum, i) => sum + (i.priceValue || 0) * (i.qty || 1), 0);
  const shipping = subtotal > 5000 || subtotal === 0 ? 0 : 150;
  const total = subtotal + shipping;

  return { cart, orderItems, subtotal, shipping, total };
}

function assertValidShippingAddress(shippingAddress) {
  const missing = REQUIRED_ADDRESS_FIELDS.filter((f) => !shippingAddress || !String(shippingAddress[f] || '').trim());
  if (missing.length) {
    throw new ApiError(400, `Please provide your shipping ${missing.join(', ')}.`);
  }
}

// Notifies the studio (email) and the admin dashboard (Socket.IO "new-order" event) that an
// order is ready to be fulfilled. Shared by createOrder (COD — fires immediately) and
// paymentController (Razorpay — fires only once payment is verified, so the admin dashboard
// never shows an order that was never actually paid for).
function notifyNewOrder(io, order, customer) {
  sendNewOrderEmail({
    order,
    customerName: customer.name,
    customerEmail: customer.email
  }).catch((err) => {
    console.error(`New order email failed for ${order.orderNumber}:`, err.message);
  });

  // Customer-facing order confirmation — sent to the person who placed the order, in
  // addition to (never instead of) the studio's own new-order inbox notification above.
  // Same fire-and-forget pattern: a failed/slow send must never block or fail checkout.
  sendOrderConfirmationEmail({
    order,
    customerName: customer.name,
    customerEmail: customer.email
  }).catch((err) => {
    console.error(`Order confirmation email failed for ${order.orderNumber}:`, err.message);
  });

  // ROOT CAUSE FIX: the admin dashboard's notification bell used to exist only as an
  // in-memory array (notifLog in js/admin.js), built up purely from live 'new-order' socket
  // events. That's why it worked when the dashboard was already open, but showed nothing
  // for anyone who opened/reloaded the dashboard even a few seconds after the order came
  // in — there was nothing anywhere to load. Persisting one row per order here means
  // GET /api/notifications (see notificationController.js) can hand the dashboard its
  // recent/unread notifications on load, regardless of when it's opened. Fire-and-forget,
  // same as the email above — a failed write here must never block checkout.
  try {
    Notification.create({
      order: order._id,
      orderNumber: order.orderNumber,
      customer: { name: customer.name, email: customer.email, phone: order.shippingAddress.phone },
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus
    }).catch((err) => {
      console.error(`Failed to persist notification for ${order.orderNumber}:`, err.message);
    });
  } catch (err) {
    // Belt-and-braces: the .catch() above only guards a *rejected* promise. If
    // Notification.create() throws synchronously instead (e.g. the model failed to load
    // correctly), this still must never take checkout down with it.
    console.error(`Failed to persist notification for ${order.orderNumber}:`, err.message);
  }

  if (io) {
    io.to('admins').emit('new-order', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      customer: { name: customer.name, email: customer.email, phone: order.shippingAddress.phone },
      shippingAddress: order.shippingAddress,
      items: order.items,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt
    });
  }
}

// @desc   Checkout — turns the current cart into an order (the "Checkout" button on cart.html)
// @route  POST /api/orders
// @access Private
exports.createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod, notes } = req.body;

  // The checkout form on cart.html marks every one of these as required — enforce that
  // server-side too, since this is the only thing standing between us and an order with
  // nowhere to ship it.
  assertValidShippingAddress(shippingAddress);

  // Online payment must go through the Razorpay flow (POST /api/payments/razorpay/order →
  // verify), which actually confirms money changed hands before marking anything "paid".
  // This endpoint no longer accepts 'razorpay' directly so a client can never talk itself
  // into a free "paid" order the way the old card/upi/paypal placeholder used to allow.
  if (paymentMethod === 'razorpay') {
    throw new ApiError(400, 'Please use the Razorpay checkout to pay online.');
  }

  // SECURITY FIX: 'card' / 'upi' / 'paypal' are only kept in the schema/validator so
  // pre-existing orders from before Razorpay was integrated still validate — nothing in
  // this codebase actually processes a payment for them (see paymentController.js, which
  // only ever handles 'razorpay'). The previous logic here — paymentStatus 'paid' for
  // ANY non-'cod' paymentMethod — meant any signed-in user could POST paymentMethod:
  // 'card' (still allowed by the route validator) and get an order marked "paid" for
  // free, with no payment of any kind having happened. This endpoint only ever creates
  // Cash-on-Delivery orders now (genuine online payment goes through
  // paymentController.createRazorpayOrder/verifyRazorpayPayment, which requires a
  // verified Razorpay signature before it will ever set paymentStatus to 'paid'), so
  // every order created here starts 'pending' regardless of the paymentMethod value.
  const { cart, orderItems, subtotal, shipping, total } = await pricedItemsFromCart(req.user._id);

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: req.user._id,
    items: orderItems,
    subtotal,
    shipping,
    total,
    shippingAddress,
    paymentMethod: paymentMethod || 'cod',
    paymentStatus: 'pending',
    notes
  });

  cart.items = [];
  await cart.save();

  // Notify the studio inbox + admin dashboard that a new order came in. The order is already
  // saved and the cart already cleared, so a failed/slow email must never fail the checkout.
  notifyNewOrder(req.app.get('io'), order, { name: req.user.name, email: req.user.email });

  res.status(201).json({
    success: true,
    message: `Order ${order.orderNumber} placed — thank you for shopping with Talking-Thread.`,
    order
  });
});

// @desc   List the logged-in user's orders
// @route  GET /api/orders
// @access Private
exports.getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort('-createdAt').lean();
  res.json({ success: true, orders });
});

// @desc   Get a single order (must belong to the requester, unless admin)
// @route  GET /api/orders/:id
// @access Private
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).lean();
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'You do not have access to this order.');
  }
  res.json({ success: true, order });
});

// @desc   List all orders
// @route  GET /api/orders/admin/all
// @access Private/Admin
exports.getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().sort('-createdAt').populate('user', 'name email phone').lean();
  res.json({ success: true, count: orders.length, orders });
});

// @desc   Update order status
// @route  PUT /api/orders/:id/status
// @access Private/Admin
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
  if (!order) throw new ApiError(404, 'Order not found.');
  res.json({ success: true, order });
});

// @desc   Update payment status (Admin Dashboard → Orders)
// @route  PUT /api/orders/:id/payment-status
// @access Private/Admin
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus } = req.body;
  const order = await Order.findByIdAndUpdate(req.params.id, { paymentStatus }, { new: true, runValidators: true });
  if (!order) throw new ApiError(404, 'Order not found.');
  res.json({ success: true, order });
});

// @desc   Cancel one of your own orders (My Orders page)
// @route  PUT /api/orders/:id/cancel
// @access Private
exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'You do not have access to this order.');
  }
  if (order.status === 'cancelled') throw new ApiError(400, 'This order is already cancelled.');
  if (order.status === 'shipped' || order.status === 'delivered') {
    throw new ApiError(400, `This order has already been ${order.status} and can no longer be cancelled.`);
  }
  order.status = 'cancelled';
  await order.save();
  res.json({ success: true, message: 'Your order has been cancelled.', order });
});

// Reused by paymentController.js for the Razorpay checkout flow.
exports.generateOrderNumber = generateOrderNumber;
exports.pricedItemsFromCart = pricedItemsFromCart;
exports.assertValidShippingAddress = assertValidShippingAddress;
exports.notifyNewOrder = notifyNewOrder;
exports.REQUIRED_ADDRESS_FIELDS = REQUIRED_ADDRESS_FIELDS;