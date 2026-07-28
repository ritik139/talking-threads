const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/productController');
const reviewCtrl = require('../controllers/reviewController');

const router = express.Router();

router.get('/', ctrl.getProducts);
router.get('/:idOrSlug', ctrl.getProduct);
router.get('/:idOrSlug/related', ctrl.getRelatedProducts);

router.post('/', protect, adminOnly, ctrl.createProduct);
router.put('/:id', protect, adminOnly, ctrl.updateProduct);
router.delete('/:id', protect, adminOnly, ctrl.deleteProduct);

// Reviews nested under a product
router.get('/:productId/reviews', reviewCtrl.getReviews);
router.post('/:productId/reviews', protect, reviewCtrl.addReview);
router.delete('/:productId/reviews/:reviewId', protect, reviewCtrl.deleteReview);

module.exports = router;
