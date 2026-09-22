const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/uploadController');

const router = express.Router();

router.post('/image', protect, adminOnly, ctrl.uploadImage);
router.delete('/image', protect, adminOnly, ctrl.deleteImage);

// Public: this is what every <img src="/api/uploads/<id>"> on the site actually
// requests. Placed after the two literal '/image' routes above so it never
// shadows them; Express only matches ':id' against a path that isn't '/image'.
router.get('/:id', ctrl.getImage);

module.exports = router;