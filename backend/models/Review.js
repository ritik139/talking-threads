const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    // Optional photo URLs attached to the review (site has no file-upload infra,
    // so — consistent with how product images are stored — these are plain URLs).
    photos: [{ type: String, trim: true }],
    // Set automatically at creation time if the reviewer has a non-cancelled order
    // containing the product being reviewed.
    verifiedPurchase: { type: Boolean, default: false }
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);