const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema(
  {
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
