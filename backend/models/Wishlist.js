const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema(
  {
    // Stable identifier for this wishlist entry. Generated client-side when an item is
    // first added (and echoed back by the API), so the frontend and database always agree
    // on which entry is which — removal/move-to-bag no longer depend on array position,
    // which could silently desync across tabs, merges, or re-fetches.
    id: { type: String, required: true, default: () => new mongoose.Types.ObjectId().toString() },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    price: { type: String, required: true },
    img: { type: String, default: '' }
  },
  { _id: false }
);

const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: [wishlistItemSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wishlist', wishlistSchema);