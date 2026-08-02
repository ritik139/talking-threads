const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    price: String,
    priceValue: Number,
    size: String,
    color: String,
    text: String,
    qty: Number
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true },
    shippingAddress: {
      fullName: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      phone: String,
      // Populated when the customer pins their delivery location on the Leaflet/OSM map in
      // the checkout modal (see js/delivery-map.js). All optional — orders placed without
      // using the map picker simply omit these, so this never blocks checkout.
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      formattedAddress: { type: String, default: '' }
    },
    // 'card' / 'upi' / 'paypal' are kept only so any pre-existing orders with those values
    // still validate — the checkout UI now only ever sends 'cod' or 'razorpay'.
    paymentMethod: { type: String, enum: ['cod', 'card', 'upi', 'paypal', 'razorpay'], default: 'cod' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    // Populated once a Razorpay order is created for this order, and again once that
    // payment is verified (see backend/controllers/paymentController.js).
    razorpay: {
      orderId: { type: String, default: null, index: true },
      paymentId: { type: String, default: null },
      signature: { type: String, default: null }
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending'
    },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

// PERF: backs reviewController.js#addSiteReview's Order.exists({ user, status, 'items.product' })
// verified-purchase check.
orderSchema.index({ user: 1, 'items.product': 1 });

module.exports = mongoose.model('Order', orderSchema);