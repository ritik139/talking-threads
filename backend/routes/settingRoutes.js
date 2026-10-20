const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/settingController');

const router = express.Router();

router.get('/studio-notice', ctrl.getStudioNotice);
router.get('/studio-notice/stream', ctrl.streamStudioNotice);
router.put('/studio-notice', protect, adminOnly, ctrl.updateStudioNotice);

module.exports = router;