const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

const router = express.Router();

// Admin dashboard notification bell — requires a signed-in admin.
router.get('/', protect, adminOnly, ctrl.getRecentNotifications);
router.put('/mark-read', protect, adminOnly, ctrl.markNotificationsRead);

module.exports = router;