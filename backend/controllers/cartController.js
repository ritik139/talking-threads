const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Cart = require('../models/Cart');

function genLineId() {
  return 'ci_' + Date.now() + Math.random().toString(16).slice(2);
}

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

// @desc   Get the logged-in user's cart
// @route  GET /api/cart
// @access Private
exports.getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  res.json({ success: true, cart: cart.items });
});

// @desc   Add an item to the cart (mirrors Store.addToCart from js/main.js)
// @route  POST /api/cart
// @access Private
exports.addToCart = asyncHandler(async (req, res) => {
  const { product, name, price, size, color, text, qty, img } = req.body;
  if (!name || !price) throw new ApiError(400, 'name and price are required.');

  const cart = await getOrCreateCart(req.user._id);
  const priceValue = Number(String(price).replace(/[^0-9.]/g, '')) || 0;

  cart.items.push({
    id: genLineId(),
    product: product || undefined,
    name,
    price,
    priceValue,
    size: size || 'Medium',
    color: color || 'Antique Gold',
    text: text || '—',
    qty: Math.max(1, parseInt(qty, 10) || 1),
    img: img || ''
  });
  await cart.save();

  res.status(201).json({ success: true, cart: cart.items });
});

// @desc   Replace the whole cart in one call (used to sync a guest/localStorage cart on login)
// @route  PUT /api/cart
// @access Private
exports.replaceCart = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) throw new ApiError(400, 'items must be an array.');

  const cart = await getOrCreateCart(req.user._id);
  cart.items = items.map((i) => ({
    id: i.id || genLineId(),
    product: i.product || undefined,
    name: i.name,
    price: i.price,
    priceValue: Number(String(i.price).replace(/[^0-9.]/g, '')) || 0,
    size: i.size || 'Medium',
    color: i.color || 'Antique Gold',
    text: i.text || '—',
    qty: Math.max(1, parseInt(i.qty, 10) || 1),
    img: i.img || ''
  }));
  await cart.save();
  res.json({ success: true, cart: cart.items });
});

// @desc   Merge a guest cart (from localStorage) into the user's server cart, used right after login
// @route  POST /api/cart/merge
// @access Private
exports.mergeCart = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) throw new ApiError(400, 'items must be an array.');

  const cart = await getOrCreateCart(req.user._id);
  items.forEach((i) => {
    cart.items.push({
      id: genLineId(),
      product: i.product || undefined,
      name: i.name,
      price: i.price,
      priceValue: Number(String(i.price).replace(/[^0-9.]/g, '')) || 0,
      size: i.size || 'Medium',
      color: i.color || 'Antique Gold',
      text: i.text || '—',
      qty: Math.max(1, parseInt(i.qty, 10) || 1),
      img: i.img || ''
    });
  });
  await cart.save();
  res.json({ success: true, cart: cart.items });
});

// @desc   Update quantity of one line item
// @route  PATCH /api/cart/:itemId
// @access Private
exports.updateCartItem = asyncHandler(async (req, res) => {
  const { qty } = req.body;
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.find((i) => i.id === req.params.itemId);
  if (!item) throw new ApiError(404, 'Cart item not found.');
  item.qty = Math.max(1, parseInt(qty, 10) || 1);
  await cart.save();
  res.json({ success: true, cart: cart.items });
});

// @desc   Remove one line item
// @route  DELETE /api/cart/:itemId
// @access Private
exports.removeCartItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = cart.items.filter((i) => i.id !== req.params.itemId);
  await cart.save();
  res.json({ success: true, cart: cart.items });
});

// @desc   Empty the cart (used after checkout)
// @route  DELETE /api/cart
// @access Private
exports.clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();
  res.json({ success: true, cart: cart.items });
});