const express = require('express');
const ctrl = require('../controllers/notificationController');

const router = express.Router();

// Intentionally NOT behind `protect`/`adminOnly` — matches orderRoutes.js's admin endpoints,
// since the admin dashboard itself doesn't require sign-in (see server.js).
router.get('/', ctrl.getRecentNotifications);
router.put('/mark-read', ctrl.markNotificationsRead);

module.exports = router;