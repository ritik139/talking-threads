const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { sendNewOrderEmail } = require('../utils/mailer');

function generateOrderNumber() {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TT-${Date.now().toString().slice(-6)}-${rand}`;
}

const REQUIRED_ADDRESS_FIELDS = ['fullName', 'phone', 'line1', 'city', 'state', 'postalCode', 'country'];

// @desc   Checkout — turns the current cart into an order (the "Checkout" button on cart.html)
// @route  POST /api/orders
// @access Private
exports.createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod, notes } = req.body;

  // The checkout form on cart.html marks every one of these as required — enforce that
  // server-side too, since this is the only thing standing between us and an order with
  // nowhere to ship it.
  const missing = REQUIRED_ADDRESS_FIELDS.filter((f) => !shippingAddress || !String(shippingAddress[f] || '').trim());
  if (missing.length) {
    throw new ApiError(400, `Please provide your shipping ${missing.join(', ')}.`);
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || !cart.items.length) throw new ApiError(400, 'Your bag is empty.');

  // Re-price every line against the live Product record instead of trusting whatever
  // price is sitting in the cart — the cart's stored price is client-supplied (see
  // cartController.addToCart) and must never be treated as authoritative at checkout.
  const productIds = cart.items.filter((i) => i.product).map((i) => i.product);
  const products = productIds.length ? await Product.find({ _id: { $in: productIds } }) : [];
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  const orderItems = cart.items.map((i) => {
    const product = i.product && productById.get(i.product.toString());
    if (product) {
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
    }
    // No linked product (e.g. a legacy/guest cart line) — fall back to what's on the cart line.
    return {
      product: i.product,
      name: i.name,
      price: i.price,
      priceValue: i.priceValue,
      size: i.size,
      color: i.color,
      text: i.text,
      qty: i.qty
    };
  });

  const subtotal = orderItems.reduce((sum, i) => sum + (i.priceValue || 0) * (i.qty || 1), 0);
  const shipping = subtotal > 5000 || subtotal === 0 ? 0 : 150;
  const total = subtotal + shipping;

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: req.user._id,
    items: orderItems,
    subtotal,
    shipping,
    total,
    shippingAddress,
    paymentMethod: paymentMethod || 'cod',
    paymentStatus: (paymentMethod && paymentMethod !== 'cod') ? 'paid' : 'pending',
    notes
  });

  cart.items = [];
  await cart.save();

  // Notify the studio inbox that a new order came in. The order is already saved and the
  // cart already cleared, so a failed/slow email must never fail the checkout — just log it.
  sendNewOrderEmail({
    order,
    customerName: req.user.name,
    customerEmail: req.user.email
  }).catch((err) => {
    console.error(`New order email failed for ${order.orderNumber}:`, err.message);
  });

  // Push the order straight into the admin dashboard in real time (see server.js, and
  // admin.js's initRealtimeNotifications, which is already listening for this event).
  const io = req.app.get('io');
  if (io) {
    io.to('admins').emit('new-order', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      customer: { name: req.user.name, email: req.user.email, phone: shippingAddress.phone },
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
  const orders = await Order.find({ user: req.user._id }).sort('-createdAt');
  res.json({ success: true, orders });
});

// @desc   Get a single order (must belong to the requester, unless admin)
// @route  GET /api/orders/:id
// @access Private
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
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
  const orders = await Order.find().sort('-createdAt').populate('user', 'name email phone');
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