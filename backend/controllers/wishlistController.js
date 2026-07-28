const asyncHandler = require('../utils/asyncHandler');
const Wishlist = require('../models/Wishlist');

async function getOrCreateWishlist(userId) {
  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) wishlist = await Wishlist.create({ user: userId, items: [] });
  return wishlist;
}

// @desc   Get the logged-in user's wishlist
// @route  GET /api/wishlist
// @access Private
exports.getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await getOrCreateWishlist(req.user._id);
  res.json({ success: true, wishlist: wishlist.items });
});

// @desc   Toggle a product in/out of the wishlist (mirrors Store.toggleWishlist)
// @route  POST /api/wishlist/toggle
// @access Private
exports.toggleWishlist = asyncHandler(async (req, res) => {
  const { product, name, price, img } = req.body;
  const wishlist = await getOrCreateWishlist(req.user._id);

  const existingIndex = wishlist.items.findIndex((i) => i.name === name);
  let added;
  if (existingIndex >= 0) {
    wishlist.items.splice(existingIndex, 1);
    added = false;
  } else {
    wishlist.items.push({ product: product || undefined, name, price, img: img || '' });
    added = true;
  }
  await wishlist.save();
  res.json({ success: true, added, wishlist: wishlist.items });
});

// @desc   Merge a guest wishlist (localStorage) in after login
// @route  POST /api/wishlist/merge
// @access Private
exports.mergeWishlist = asyncHandler(async (req, res) => {
  const { items } = req.body;
  const wishlist = await getOrCreateWishlist(req.user._id);
  (items || []).forEach((i) => {
    if (!wishlist.items.some((existing) => existing.name === i.name)) {
      wishlist.items.push({ product: i.product || undefined, name: i.name, price: i.price, img: i.img || '' });
    }
  });
  await wishlist.save();
  res.json({ success: true, wishlist: wishlist.items });
});

// @desc   Remove a single wishlist item by index
// @route  DELETE /api/wishlist/:index
// @access Private
exports.removeWishlistItem = asyncHandler(async (req, res) => {
  const idx = parseInt(req.params.index, 10);
  const wishlist = await getOrCreateWishlist(req.user._id);
  wishlist.items = wishlist.items.filter((_, i) => i !== idx);
  await wishlist.save();
  res.json({ success: true, wishlist: wishlist.items });
});
