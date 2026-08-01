const asyncHandler = require('../utils/asyncHandler');
const Notification = require('../models/Notification');

// @desc   Recent notifications for the admin dashboard's bell panel — this is what makes
//         notifications survive opening/reloading the dashboard after the fact, instead of
//         only ever existing in a live socket event (see orderController.js#notifyNewOrder).
// @route  GET /api/notifications
// @access Private/Admin
exports.getRecentNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const [notifications, unreadCount] = await Promise.all([
    Notification.find().sort('-createdAt').limit(limit).lean(),
    Notification.countDocuments({ read: false })
  ]);

  // Shaped to match the payload js/admin.js already knows how to render from live socket
  // events (orderId, orderNumber, customer{...}, total, paymentMethod, paymentStatus,
  // createdAt) — so the same rendering code path can be reused for both.
  const shaped = notifications.map((n) => ({
    orderId: n.order,
    orderNumber: n.orderNumber,
    customer: n.customer,
    total: n.total,
    paymentMethod: n.paymentMethod,
    paymentStatus: n.paymentStatus,
    createdAt: n.createdAt,
    read: n.read
  }));

  res.json({ success: true, notifications: shaped, unreadCount });
});

// @desc   Mark notifications as read — called once the bell panel is opened, so the unread
//         badge count stays accurate across reloads instead of resetting to 0 only locally.
// @route  PUT /api/notifications/mark-read
// @access Admin dashboard
exports.markNotificationsRead = asyncHandler(async (req, res) => {
  const { ids } = req.body || {};
  const filter = Array.isArray(ids) && ids.length ? { _id: { $in: ids } } : { read: false };
  await Notification.updateMany(filter, { $set: { read: true } });
  res.json({ success: true });
});