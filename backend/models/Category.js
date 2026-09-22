const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * A shop-page category, owned by the admin instead of being hard-coded.
 *
 * `name` is the exact string stored on Product.category, so it is the value the
 * shop filter sends back as ?category=... — that's why it must stay unique and
 * must not be renamed casually (see categoryController.updateCategory, which
 * rewrites every product when the name changes).
 * `label` is only what the shopper sees, so "Kidswear" can display as "Kids Wear".
 */
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    label: { type: String, default: '', trim: true },
    slug: { type: String, index: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    // Lower numbers appear higher in the filter sidebar
    order: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

categorySchema.pre('validate', function normalise(next) {
  if (this.name) {
    if (!this.label) this.label = this.name;
    if (!this.slug || this.isModified('name')) {
      this.slug = slugify(this.name, { lower: true, strict: true });
    }
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);