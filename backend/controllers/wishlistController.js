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
  const { id, product, name, price, img } = req.body;
  const wishlist = await getOrCreateWishlist(req.user._id);

  // Toggling ("save"/"un-save" via the heart icon) is still matched by product identity
  // (name), which is correct for that interaction — it's asking "is this product saved?".
  const existingIndex = wishlist.items.findIndex((i) => i.name === name);
  let added;
  if (existingIndex >= 0) {
    wishlist.items.splice(existingIndex, 1);
    added = false;
  } else {
    // Preserve the id the client generated for this item so the same id can later be used
    // to remove this exact entry (see removeWishlistItem) without relying on array index.
    wishlist.items.push({ id: id || undefined, product: product || undefined, name, price, img: img || '' });
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
      wishlist.items.push({ id: i.id || undefined, product: i.product || undefined, name: i.name, price: i.price, img: i.img || '' });
    }
  });
  await wishlist.save();
  res.json({ success: true, wishlist: wishlist.items });
});

// @desc   Remove a single wishlist item by its stable id
// @route  DELETE /api/wishlist/:id
// @access Private
exports.removeWishlistItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const wishlist = await getOrCreateWishlist(req.user._id);
  wishlist.items = wishlist.items.filter((item) => item.id !== id);
  await wishlist.save();
  res.json({ success: true, wishlist: wishlist.items });
});