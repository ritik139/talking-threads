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

  const sortMap = {
    featured: '-isFeatured -isBestSeller -createdAt',
    price_asc: 'price',
    price_desc: '-price',
    newest: '-createdAt'
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
  const product = await Product.findOne(query);
  if (!product) throw new ApiError(404, 'Product not found.');

  const related = await Product.find({
    _id: { $ne: product._id },
    category: product.category,
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