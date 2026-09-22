const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 }, // stored in rupees, e.g. 2450
    compareAtPrice: { type: Number, default: null },
    // Array so a product can appear under more than one shop-page filter at once
    // (e.g. a hoop that's both "Wall Art" and part of the "Accessories" showcase).
    // NOT an enum any more. The category list is now owned by the admin (see
    // models/Category.js and the Categories tab in the dashboard), so a fixed
    // enum here would reject every product filed under a category the admin
    // added after this file was written — the create would fail validation with
    // "is not a valid enum value" and the new category could never hold stock.
    // Validity is enforced at the controller instead, against the live Category
    // collection, which is the only place that knows the current list.
    category: {
      type: [{ type: String, trim: true }],
      default: ['Wall Art'],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0 && arr.every((c) => c && c.trim()),
        message: 'A product needs at least one category.'
      }
    },
    // Marketing groupings shown on collections.html (a product can belong to more
    // than one). Free-form for the same reason as `category` above.
    collections: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],
    images: [{ type: String }],
    // Matches the exact thread-colour swatches in shop.html's filter sidebar (.swatch[data-color])
    // Free-form so the admin can add a size the shop didn't ship with (e.g. "XXL",
    // "Extra Large — 20in") without this model rejecting the product.
    sizes: [{ type: String, trim: true }],
    colors: [{ type: String, enum: ['maroon', 'gold', 'sage', 'ivory', 'midnight', 'blush'] }],
    availability: { type: String, enum: ['In Stock', 'Made to Order'], default: 'Made to Order' },
    isNewArrival: { type: Boolean, default: false },
    customizable: { type: Boolean, default: true },
    maxCustomTextLength: { type: Number, default: 20 },
    stock: { type: Number, default: 100, min: 0 },
    isFeatured: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', tags: 'text' });

// PERF: every public product query (shop grid, related products, chat product lookup) filters
// on isActive first, then usually category and/or the default sort order below — these mirror
// productController.js#getProducts / getRelatedProducts and chatController.js#findRelevantProducts
// so those queries can use an index instead of scanning the whole collection under load.
productSchema.index({ isActive: 1, category: 1, createdAt: -1 });
productSchema.index({ isActive: 1, isFeatured: -1, isBestSeller: -1, createdAt: -1 });
productSchema.index({ isActive: 1, price: 1 });

productSchema.pre('validate', function generateSlug(next) {
  if (this.name && (!this.slug || this.isModified('name'))) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Convenience virtual for the display price used across the existing UI, e.g. "₹2,450"
productSchema.virtual('displayPrice').get(function displayPrice() {
  return '₹' + Number(this.price || 0).toLocaleString('en-IN');
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);