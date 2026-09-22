const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/productController');
const reviewCtrl = require('../controllers/reviewController');

const router = express.Router();

router.get('/', ctrl.getProducts);

// IMPORTANT: both of these must stay ABOVE '/:idOrSlug'. Express matches routes
// in order, so if they came after, "facets" and "admin" would be swallowed by
// the :idOrSlug parameter and answered with "Product not found."
router.get('/facets', ctrl.getFacets);
router.get('/admin/all', protect, adminOnly, ctrl.getProductsAdmin);

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