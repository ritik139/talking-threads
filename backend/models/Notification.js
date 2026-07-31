const mongoose = require('mongoose');

// Persists the same "new order" event the admin dashboard shows live via Socket.IO (see
// orderController.js#notifyNewOrder), so opening the dashboard *after* an order came in
// still shows it — previously that event only ever existed in each browser tab's in-memory
// notifLog array (js/admin.js), so it was lost the moment nobody had the dashboard open.
const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['new-order'], default: 'new-order' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true },
    customer: {
      name: String,
      email: String,
      phone: String
    },
    total: { type: Number, default: 0 },
    paymentMethod: { type: String, default: 'cod' },
    paymentStatus: { type: String, default: 'pending' },
    read: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);