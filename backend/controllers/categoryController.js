const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Category = require('../models/Category');
const Product = require('../models/Product');

// Display names the site already used for categories that were previously
// hard-coded in shop.html — kept so the sidebar keeps reading "Kids Wear"
// rather than "Kidswear" after the list becomes database-driven.
const LEGACY_LABELS = {
  Kidswear: 'Kids Wear'
};

const LEGACY_ORDER = ['Wall Art', 'Accessories', 'Clothing', 'Kidswear'];

/**
 * How many ACTIVE products sit in each category.
 * Product.category is an array, so $unwind before grouping — a product that is
 * both "Wall Art" and "Accessories" must count once under each.
 */
async function countByCategory() {
  const rows = await Product.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$category' },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);
  const map = {};
  rows.forEach((row) => {
    if (row._id) map[row._id] = row.count;
  });
  return map;
}

/**
 * The category list used to live only in shop.html's markup, so an existing
 * database has products in categories that have no Category document yet.
 * Rather than needing a separate migration script, create any missing one the
 * first time the list is asked for. Purely additive: it never edits or removes
 * a category the admin has already set up.
 */
async function backfillMissingCategories(counts) {
  const names = Object.keys(counts);
  if (!names.length) return;

  const existing = await Category.find({ name: { $in: names } }).select('name');
  const known = new Set(existing.map((c) => c.name));
  const missing = names.filter((name) => !known.has(name));
  if (!missing.length) return;

  await Promise.all(
    missing.map((name) => {
      const legacyIndex = LEGACY_ORDER.indexOf(name);
      return Category.create({
        name,
        label: LEGACY_LABELS[name] || name,
        order: legacyIndex === -1 ? 100 : legacyIndex
      }).catch(() => null); // a concurrent request may have just created it
    })
  );
}

// @desc   Category list for the shop filter sidebar, each with its live product count
// @route  GET /api/categories
// @access Public
exports.getCategories = asyncHandler(async (req, res) => {
  const counts = await countByCategory();
  await backfillMissingCategories(counts);

  const includeInactive = req.query.all === 'true' && req.user && req.user.role === 'admin';
  const filter = includeInactive ? {} : { isActive: true };

  const categories = await Category.find(filter).sort({ order: 1, name: 1 });

  res.json({
    success: true,
    categories: categories.map((cat) => ({
      _id: cat._id,
      name: cat.name,
      label: cat.label || cat.name,
      slug: cat.slug,
      image: cat.image,
      order: cat.order,
      isActive: cat.isActive,
      count: counts[cat.name] || 0
    }))
  });
});

// @desc   Full category list for the admin dashboard (includes hidden ones)
// @route  GET /api/categories/admin/all
// @access Private/Admin
exports.getCategoriesAdmin = asyncHandler(async (req, res) => {
  const counts = await countByCategory();
  await backfillMissingCategories(counts);

  const categories = await Category.find({}).sort({ order: 1, name: 1 });

  res.json({
    success: true,
    categories: categories.map((cat) => ({
      _id: cat._id,
      name: cat.name,
      label: cat.label || cat.name,
      slug: cat.slug,
      image: cat.image,
      description: cat.description,
      order: cat.order,
      isActive: cat.isActive,
      count: counts[cat.name] || 0
    }))
  });
});

// @desc   Create a category
// @route  POST /api/categories
// @access Private/Admin
exports.createCategory = asyncHandler(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) throw new ApiError(400, 'Please enter a category name.');

  // Case-insensitive duplicate check — "wall art" and "Wall Art" would otherwise
  // become two separate filter rows holding the same products.
  const clash = await Category.findOne({
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  });
  if (clash) throw new ApiError(409, `"${clash.name}" already exists as a category.`);

  const category = await Category.create({
    name,
    label: (req.body.label || '').trim() || name,
    description: req.body.description || '',
    image: req.body.image || '',
    order: req.body.order === undefined ? 100 : Number(req.body.order),
    isActive: req.body.isActive === undefined ? true : !!req.body.isActive
  });

  res.status(201).json({ success: true, category });
});

// @desc   Update a category
// @route  PUT /api/categories/:id
// @access Private/Admin
exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found.');

  const nextName = (req.body.name || '').trim();

  // Renaming a category has to rewrite every product that referenced it by the
  // old string, or those products drop out of the filter entirely (the shop
  // sends ?category=<name>, and Product.category still holds the old text).
  if (nextName && nextName !== category.name) {
    const clash = await Category.findOne({
      _id: { $ne: category._id },
      name: new RegExp(`^${nextName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    });
    if (clash) throw new ApiError(409, `"${clash.name}" already exists as a category.`);

    const oldName = category.name;
    category.name = nextName;
    await Product.updateMany({ category: oldName }, { $set: { 'category.$[el]': nextName } }, {
      arrayFilters: [{ el: oldName }]
    });
  }

  if (req.body.label !== undefined) category.label = (req.body.label || '').trim() || category.name;
  if (req.body.description !== undefined) category.description = req.body.description;
  if (req.body.image !== undefined) category.image = req.body.image;
  if (req.body.order !== undefined) category.order = Number(req.body.order);
  if (req.body.isActive !== undefined) category.isActive = !!req.body.isActive;

  await category.save();
  res.json({ success: true, category });
});

// @desc   Delete a category (blocked while products still use it)
// @route  DELETE /api/categories/:id
// @access Private/Admin
exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found.');

  const inUse = await Product.countDocuments({ category: category.name, isActive: true });
  if (inUse > 0 && req.query.force !== 'true') {
    throw new ApiError(
      409,
      `${inUse} product${inUse === 1 ? '' : 's'} still use "${category.name}". Move them to another category first, or hide this category instead of deleting it.`
    );
  }

  await category.deleteOne();
  res.json({ success: true, message: `"${category.name}" removed.` });
});