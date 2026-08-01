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

  const priceValue = Number(String(price).replace(/[^0-9.]/g, '')) || 0;
  const newItem = {
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
  };

  // ROOT CAUSE FIX: this used to be getOrCreateCart() -> cart.items.push(...) -> cart.save(),
  // a read-modify-write on the WHOLE cart document. Two such writes racing (e.g. a qty
  // change and an add-to-cart arriving close together) could let one silently overwrite the
  // other depending purely on which network round trip happened to finish last — invisible
  // on localhost (near-zero, effectively FIFO latency) but reproducible in production where
  // real network jitter lets responses arrive out of order. $push via findOneAndUpdate is a
  // single atomic operation at the database layer, so it can never be clobbered by, or
  // clobber, a concurrent mutation, regardless of arrival order.
  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    { $push: { items: newItem } },
    { new: true, upsert: true }
  );

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
//
// ROOT CAUSE FIX (production-only "wrong cart/order total" bug):
// The qty stepper on cart.html fires this endpoint with the ABSOLUTE new qty
// (js/main.js: Store.updateCartQty(id, (item.qty || 1) + 1)). The old implementation here
// loaded the whole cart document, mutated item.qty in Node memory, and called cart.save() —
// a read-modify-write. When a user clicks "+" twice quickly, two such requests are in
// flight together; over a real network their responses/saves can complete OUT OF ORDER
// (the second click's write finishing before the first's), so the first click's save,
// still holding its now-stale in-memory copy, lands LAST and silently reverts the qty.
// pricedItemsFromCart() then re-prices the *next* checkout straight from that reverted
// server-side qty, freezing the wrong number permanently into order.total/subtotal — which
// is exactly what showed up as a right-item-count-wrong-number mismatch on My Orders.
// On localhost, requests to the same machine complete in send order with no jitter, so this
// reordering essentially never occurs — which is why it only ever showed up on Render.
//
// Fix: accept a relative `delta` (js/main.js now sends +1/-1 instead of the absolute
// target) and apply it with a single atomic, order-independent MongoDB update. $inc-style
// deltas are commutative — applying +1 then +1 gives the same end result no matter which
// one the database processes first — so two concurrent requests can never clobber each
// other's effect regardless of network timing. The absolute `qty` field is still accepted
// as a fallback so an older cached client (or an admin tool) keeps working unchanged.
exports.updateCartItem = asyncHandler(async (req, res) => {
  const delta = parseInt(req.body.delta, 10);

  if (Number.isFinite(delta) && delta !== 0) {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id, 'items.id': req.params.itemId },
      [
        {
          $set: {
            items: {
              $map: {
                input: '$items',
                as: 'i',
                in: {
                  $cond: [
                    { $eq: ['$$i.id', req.params.itemId] },
                    { $mergeObjects: ['$$i', { qty: { $max: [1, { $add: ['$$i.qty', delta] }] } }] },
                    '$$i'
                  ]
                }
              }
            }
          }
        }
      ],
      { new: true }
    );
    if (!cart) throw new ApiError(404, 'Cart item not found.');
    return res.json({ success: true, cart: cart.items });
  }

  // Backward-compatible absolute-qty path (e.g. an admin tool setting an exact quantity).
  // Still a single atomic operation — no full-document load/save — so it carries none of
  // the original race, it just can't be merged commutatively with a concurrent delta.
  const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id, 'items.id': req.params.itemId },
    { $set: { 'items.$.qty': qty } },
    { new: true }
  );
  if (!cart) throw new ApiError(404, 'Cart item not found.');
  res.json({ success: true, cart: cart.items });
});

// @desc   Remove one line item
// @route  DELETE /api/cart/:itemId
// @access Private
exports.removeCartItem = asyncHandler(async (req, res) => {
  // Atomic $pull instead of load-filter-save — same reasoning as addToCart/updateCartItem
  // above: a full-document save here could otherwise silently undo a concurrent qty change
  // made by a different in-flight request.
  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { items: { id: req.params.itemId } } },
    { new: true, upsert: true }
  );
  res.json({ success: true, cart: cart.items });
});

// @desc   Empty the cart (used after checkout)
// @route  DELETE /api/cart
// @access Private
exports.clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    { $set: { items: [] } },
    { new: true, upsert: true }
  );
  res.json({ success: true, cart: cart.items });
});