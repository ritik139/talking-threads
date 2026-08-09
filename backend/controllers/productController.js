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

  // `andConditions` collects every clause that itself needs an `$or` (free-text search,
  // price bands) so multiple of them can be combined safely — a filter object can only
  // have ONE top-level `$or` key, so a second `filter.$or = ...` would silently overwrite
  // the first instead of combining with it (e.g. searching "hoop" AND checking a price
  // band together used to drop the search entirely). Each `$or` clause is pushed into
  // `$and` instead, where they combine correctly.
  const andConditions = [];

  // BUG FIX (search returning no results for perfectly valid, in-stock products):
  // This used to run `$text: { $search: q }`, MongoDB's whole-word text index search.
  // $text tokenizes the query into complete words (with stemming) and only matches
  // complete words in the indexed fields — it does NOT do substring/prefix matching.
  // That silently broke two real things this UI promises:
  //   1. The header search fires live suggestions from just 2 typed characters
  //      (see initHeaderSearch in js/main.js) — so almost every keystroke while
  //      someone is still typing a word (e.g. "welcom", "grih", "hous") is a partial
  //      word, which $text simply never matches, even though the finished word exists
  //      on a real, active product. Results only appeared once the whole word was typed.
  //   2. A plain typo or partial product name typed into the Shop search box (e.g.
  //      "hankerchief") also matched nothing, since $text has no fuzzy/substring logic.
  //   $text could also throw outright on certain inputs (e.g. a query that's only
  //   punctuation/stopwords, or a lone leading "-") — chatController.js already had to
  //   special-case that failure mode; this endpoint had no such handling and would
  //   surface it as a hard 500 ("Could not load products right now").
  // Fix: match with a case-insensitive substring regex across name/tags/description
  // instead. This finds partial words as they're typed, tolerates the same edge-case
  // input that used to throw (special regex characters are escaped, never interpreted),
  // and never errors on any input.
  //
  // SECOND FIX (this pass — re-check found another real gap): the first version above
  // matched the ENTIRE query as one literal phrase, so it still required the typed words
  // to be adjacent in that exact order inside a single field. A shopper typing category +
  // item together — e.g. "welcome hoop" for "Welcome Home Floral Heart Embroidery Hoop
  // with Tassels", or "griha hoop" for "Griha Pravesh Housewarming Embroidery Hoop" —
  // got zero results even though every word they typed is genuinely on that product,
  // because "welcome" and "hoop" aren't next to each other in the name. Fix: split the
  // query on whitespace and require EACH word to independently match somewhere across
  // name/tags/description/shortDescription (AND across words, OR across fields per word
  // and OR across which field each word lands in) — word order and adjacency no longer
  // matter, matching how people actually type a product search.
  // Search matches the product NAME only (not tags/description) — so a typed word only
  // surfaces products whose actual name contains it, e.g. "ba" won't pull in a product
  // whose name has no "ba" in it just because it happens to be tagged "baby gift".
  if (q && q.trim()) {
    const words = q.trim().split(/\s+/).filter(Boolean);
    words.forEach((word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      andConditions.push({ name: re });
    });
  }

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
    if (bands.length) andConditions.push({ $or: bands });
  } else if (minPrice || maxPrice) {
    // Still supported directly for callers that want one explicit continuous range.
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  if (andConditions.length) filter.$and = andConditions;

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

// Words used in product names to tell what KIND of item a product actually is
// (hoop / handkerchief / hoodie / shirt, etc). "category" (Wall Art, Kidswear,
// Accessories...) is a broad shop-filter grouping shared across very different
// item types — e.g. a hoop and a handkerchief can both be "Kidswear", and a shirt
// and a hoop can both be "Accessories" — so it's NOT a reliable signal for "same
// type of product" and must not be used to pick related-product thumbnails.
// Shirt and Hoodie are grouped as one "Clothing" family since they're both
// wearable apparel and there are too few of either alone to fill the strip.
const PRODUCT_TYPE_GROUPS = {
  Handkerchief: ['Handkerchief'],
  Hoop: ['Hoop'],
  Clothing: ['Shirt', 'Hoodie']
};

function detectProductTypeWords(name) {
  const groupKey = Object.keys(PRODUCT_TYPE_GROUPS).find(key =>
    PRODUCT_TYPE_GROUPS[key].some(word => new RegExp(`\\b${word}\\b`, 'i').test(name || ''))
  );
  return groupKey ? PRODUCT_TYPE_GROUPS[groupKey] : null;
}

// @desc   Related products — strictly other products of the SAME kind of item
//         (other handkerchiefs for a handkerchief, other hoops for a hoop, other
//         shirts/hoodies for a shirt or hoodie). Never mixes in a different kind
//         of item, even if it happens to share a shop-filter category. If there
//         aren't 4 same-type products, the front end repeats the main photo to
//         fill the remaining thumbnail slots rather than showing something else.
// @route  GET /api/products/:idOrSlug/related
// @access Public
exports.getRelatedProducts = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const query = idOrSlug.match(/^[0-9a-fA-F]{24}$/) ? { _id: idOrSlug } : { slug: idOrSlug };
  const product = await Product.findOne({ ...query, isActive: true });
  if (!product) throw new ApiError(404, 'Product not found.');

  const LIMIT = 4;
  const typeWords = detectProductTypeWords(product.name);

  const related = typeWords
    ? await Product.find({
        _id: { $ne: product._id },
        name: new RegExp(`\\b(${typeWords.join('|')})\\b`, 'i'),
        isActive: true
      }).limit(LIMIT)
    : [];

  if (!typeWords) {
    // No known type word matched this product's name (shouldn't normally happen) —
    // fall back to same-category as a last resort rather than showing nothing.
    const fillers = await Product.find({
      _id: { $ne: product._id },
      category: { $in: product.category },
      isActive: true
    }).limit(LIMIT);
    related.push(...fillers);
  }

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