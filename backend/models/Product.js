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
    category: {
      type: String,
      enum: ['Wall Art', 'Table Linen', 'Home', 'Kidswear', 'Accessories'],
      default: 'Wall Art'
    },
    // Marketing groupings shown on collections.html (a product can belong to more than one)
    collections: [
      {
        type: String,
        enum: [
          'Floral Reverie',
          'Monogram Edit',
          'Table & Linen',
          'Wall Art Hoops',
          'Bridal Trousseau',
          'Little Ones',
          'Festive Table',
          'Everyday Carry'
        ]
      }
    ],
    tags: [{ type: String, trim: true }],
    images: [{ type: String }],
    // Matches the exact thread-colour swatches in shop.html's filter sidebar (.swatch[data-color])
    sizes: [{ type: String, enum: ['Small — 8in', 'Medium — 12in', 'Large — 16in'] }],
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