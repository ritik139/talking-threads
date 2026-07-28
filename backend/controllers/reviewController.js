const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');

async function recalcProductRating(productId) {
  const stats = await Review.aggregate([
    { $match: { product: productId } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const { avg = 0, count = 0 } = stats[0] || {};
  await Product.findByIdAndUpdate(productId, { ratingAverage: Math.round(avg * 10) / 10, ratingCount: count });
}

// @desc   List reviews for a product
// @route  GET /api/products/:productId/reviews
// @access Public
exports.getReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId }).sort('-createdAt');
  res.json({ success: true, count: reviews.length, reviews });
});

// @desc   Add a review (one per user per product)
// @route  POST /api/products/:productId/reviews
// @access Private
exports.addReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.productId);
  if (!product) throw new ApiError(404, 'Product not found.');

  const existing = await Review.findOne({ product: product._id, user: req.user._id });
  if (existing) throw new ApiError(409, 'You have already reviewed this product.');

  const review = await Review.create({
    product: product._id,
    user: req.user._id,
    name: req.user.name,
    rating,
    comment
  });

  await recalcProductRating(product._id);
  res.status(201).json({ success: true, review });
});

// @desc   Delete own review (or admin)
// @route  DELETE /api/products/:productId/reviews/:reviewId
// @access Private
exports.deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.reviewId);
  if (!review) throw new ApiError(404, 'Review not found.');
  if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'You can only remove your own review.');
  }
  await review.deleteOne();
  await recalcProductRating(review.product);
  res.json({ success: true, message: 'Review removed.' });
});

/* ============================================================
   Sitewide endpoints — power the dedicated reviews.html page,
   which shows every review across every product in one place.
   ============================================================ */

// @desc   List reviews across every product, newest first by default
// @route  GET /api/reviews?rating=&sort=&page=&limit=
// @access Public
exports.getAllReviews = asyncHandler(async (req, res) => {
  const { rating, sort = 'newest', page = 1, limit = 9 } = req.query;

  const filter = {};
  if (rating) filter.rating = Number(rating);

  const sortMap = {
    newest: '-createdAt',
    oldest: 'createdAt',
    highest: '-rating -createdAt',
    lowest: 'rating -createdAt'
  };
  const sortOrder = sortMap[sort] || sortMap.newest;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 9));

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort(sortOrder)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('product', 'name slug images'),
    Review.countDocuments(filter)
  ]);

  res.json({
    success: true,
    count: reviews.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    reviews
  });
});

// @desc   Sitewide rating summary — average, total count, and a 5→1 star breakdown
// @route  GET /api/reviews/summary
// @access Public
exports.getReviewSummary = asyncHandler(async (req, res) => {
  const [overall, breakdownRaw] = await Promise.all([
    Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    Review.aggregate([{ $group: { _id: '$rating', count: { $sum: 1 } } }])
  ]);

  const { avg = 0, count = 0 } = overall[0] || {};
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  breakdownRaw.forEach((b) => { breakdown[b._id] = b.count; });

  res.json({ success: true, average: Math.round(avg * 10) / 10, count, breakdown });
});

// @desc   Submit a review from the dedicated Reviews page (reviewer picks the product in the form)
// @route  POST /api/reviews
// @access Private
exports.addSiteReview = asyncHandler(async (req, res) => {
  const { productId, rating, comment, photos } = req.body;
  if (!productId) throw new ApiError(400, 'Please choose which piece you are reviewing.');

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found.');

  const existing = await Review.findOne({ product: product._id, user: req.user._id });
  if (existing) throw new ApiError(409, 'You have already reviewed this product.');

  const hasOrder = await Order.exists({
    user: req.user._id,
    status: { $ne: 'cancelled' },
    'items.product': product._id
  });

  const review = await Review.create({
    product: product._id,
    user: req.user._id,
    name: req.user.name,
    rating,
    comment,
    photos: Array.isArray(photos) ? photos.filter(Boolean).slice(0, 3) : [],
    verifiedPurchase: !!hasOrder
  });

  await recalcProductRating(product._id);
  const populated = await review.populate('product', 'name slug images');
  res.status(201).json({ success: true, review: populated });
});