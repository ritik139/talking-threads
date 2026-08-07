const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Product = require('../models/Product');

const PRICE_BANDS = {
  'under-2000': { price: { $lte: 1999 } },
  '2000-3500': { price: { $gte: 2000, $lte: 3500 } },
  'above-3500': { price: { $gte: 3501 } }
};

// @desc   List products with search / filter / sort / pagination (powers the shop grid + search)
// @route  GET /api/products
// @access Public
exports.getProducts = asyncHandler(async (req, res) => {
  const {
    q,
    category,
    collection,
    size,
    color,
    availability,
    minPrice,
    maxPrice,
    priceBand,
    isFeatured,
    isBestSeller,
    sort = 'featured',
    page = 1,
    limit = 20
  } = req.query;

  const filter = { isActive: true };
  if (q) filter.$text = { $search: q };

  // category / collection / size / color / availability can each be a single value or comma-separated list
  if (category) filter.category = { $in: category.split(',') };
  if (collection) filter.collections = { $in: collection.split(',') };
  if (size) filter.sizes = { $in: size.split(',') };
  if (color) filter.colors = { $in: color.split(',') };
  if (availability) filter.availability = { $in: availability.split(',') };

  if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';
  if (isBestSeller !== undefined) filter.isBestSeller = isBestSeller === 'true';

  // Price: `priceBand` supports one or more of the sidebar's checkbox buckets at once
  // (e.g. "Under ₹2,000" AND "Above ₹3,500" checked together — a disjoint OR, not a
  // single min/max range, which is why this can't be collapsed into minPrice/maxPrice).
  if (priceBand) {
    const bands = priceBand
      .split(',')
      .map((key) => PRICE_BANDS[key])
      .filter(Boolean);
    if (bands.length) filter.$or = bands;
  } else if (minPrice || maxPrice) {
    // Still supported directly for callers that want one explicit continuous range.
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  // ROOT CAUSE FIX (Shop page images/order changing between identical requests):
  // None of these sort keys are unique on their own — plenty of products can tie on
  // isFeatured/isBestSeller/createdAt (especially several added in the same batch, which
  // can land on the exact same createdAt millisecond) or on price. Mongo does not guarantee
  // any particular order among documents that tie on every requested sort field; which
  // tied document ends up right at the skip/limit page boundary can differ between two
  // otherwise-identical requests. That's enough to make a newly added product swap places
  // with an older one right at the edge of page 1 — visually indistinguishable from "the
  // new product's image got replaced by an old one". Appending `_id` (unique, always
  // present) as the final tiebreaker on every branch makes the order fully deterministic:
  // the same filter+sort always returns the same order, every time.
  const sortMap = {
    featured: '-isFeatured -isBestSeller -createdAt -_id',
    price_asc: 'price _id',
    price_desc: '-price -_id',
    newest: '-createdAt -_id'
  };
  const sortOrder = sortMap[sort] || sort || sortMap.featured;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sortOrder)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments(filter)
  ]);

  res.json({
    success: true,
    count: products.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    products
  });
});

// @desc   Get a single product by slug or id
// @route  GET /api/products/:idOrSlug
// @access Public
exports.getProduct = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const query = idOrSlug.match(/^[0-9a-fA-F]{24}$/) ? { _id: idOrSlug } : { slug: idOrSlug };
  const product = await Product.findOne({ ...query, isActive: true });
  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ success: true, product });
});

// @desc   Related products (same category, excluding current)
// @route  GET /api/products/:idOrSlug/related
// @access Public
exports.getRelatedProducts = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const query = idOrSlug.match(/^[0-9a-fA-F]{24}$/) ? { _id: idOrSlug } : { slug: idOrSlug };
  const product = await Product.findOne({ ...query, isActive: true });
  if (!product) throw new ApiError(404, 'Product not found.');

  // category is now an array, so match products sharing ANY of the same categories
  // rather than requiring an exact array match.
  const related = await Product.find({
    _id: { $ne: product._id },
    category: { $in: product.category },
    isActive: true
  }).limit(4);

  res.json({ success: true, products: related });
});

// @desc   Create a product
// @route  POST /api/products
// @access Private/Admin
exports.createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, product });
});

// @desc   Update a product
// @route  PUT /api/products/:id
// @access Private/Admin
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ success: true, product });
});

// @desc   Delete (deactivate) a product
// @route  DELETE /api/products/:id
// @access Private/Admin
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ success: true, message: 'Product removed.' });
});