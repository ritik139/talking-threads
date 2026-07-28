const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { sendNewOrderEmail } = require('../utils/mailer');

function generateOrderNumber() {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TT-${Date.now().toString().slice(-6)}-${rand}`;
}

// @desc   Checkout — turns the current cart into an order (the "Checkout" button on cart.html)
// @route  POST /api/orders
// @access Private
exports.createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod, notes } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || !cart.items.length) throw new ApiError(400, 'Your bag is empty.');

  const subtotal = cart.items.reduce((sum, i) => sum + (i.priceValue || 0) * (i.qty || 1), 0);
  const shipping = subtotal > 5000 || subtotal === 0 ? 0 : 150;
  const total = subtotal + shipping;

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: req.user._id,
    items: cart.items.map((i) => ({
      product: i.product,
      name: i.name,
      price: i.price,
      priceValue: i.priceValue,
      size: i.size,
      color: i.color,
      text: i.text,
      qty: i.qty
    })),
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