const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/wishlistController');

const router = express.Router();

router.use(protect);

router.get('/', ctrl.getWishlist);
router.post('/toggle', ctrl.toggleWishlist);
router.post('/merge', ctrl.mergeWishlist);
router.delete('/:id', ctrl.removeWishlistItem);

module.exports = router;