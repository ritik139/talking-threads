const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/uploadController');

const router = express.Router();

router.post('/image', protect, adminOnly, ctrl.uploadImage);
router.delete('/image', protect, adminOnly, ctrl.deleteImage);

module.exports = router;