const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/cartController');

const router = express.Router();

router.use(protect);

router.get('/', ctrl.getCart);
router.post('/', ctrl.addToCart);
router.put('/', ctrl.replaceCart);
router.post('/merge', ctrl.mergeCart);
router.patch('/:itemId', ctrl.updateCartItem);
router.delete('/:itemId', ctrl.removeCartItem);
router.delete('/', ctrl.clearCart);

module.exports = router;
