const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    price: { type: String, required: true }, // display string kept for exact UI parity, e.g. "₹2,450"
    priceValue: { type: Number, default: 0 },
    size: { type: String, default: 'Medium' },
    color: { type: String, default: 'Antique Gold' },
    text: { type: String, default: '—' },
    qty: { type: Number, default: 1, min: 1 },
    img: { type: String, default: '' }
  },
  { _id: false }
);

// Give each cart line a stable client-facing id, mirroring the old localStorage "ci_<ts><rand>" ids
cartItemSchema.add({ id: { type: String, required: true } });

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: [cartItemSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);