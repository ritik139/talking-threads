const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/reviewController');

const router = express.Router();

// Sitewide review endpoints powering reviews.html (separate from the
// per-product routes nested under /api/products/:productId/reviews).
router.get('/summary', ctrl.getReviewSummary);
router.get('/', ctrl.getAllReviews);
router.post('/', protect, ctrl.addSiteReview);

module.exports = router;