const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const JournalPost = require('../models/JournalPost');

// @desc   List published journal posts (journal.html)
// @route  GET /api/journal
// @access Public
exports.getPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, tag } = req.query;
  const filter = { isPublished: true };
  if (tag) filter.tags = tag;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

  const [posts, total] = await Promise.all([
    JournalPost.find(filter)
      .sort('-publishedAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    JournalPost.countDocuments(filter)
  ]);

  res.json({ success: true, count: posts.length, total, page: pageNum, pages: Math.ceil(total / limitNum), posts });
});

// @desc   Get a single post by slug (journal-post.html)
// @route  GET /api/journal/:slug
// @access Public
exports.getPost = asyncHandler(async (req, res) => {
  const post = await JournalPost.findOne({ slug: req.params.slug, isPublished: true });
  if (!post) throw new ApiError(404, 'Journal post not found.');
  res.json({ success: true, post });
});

// @desc   Create a post
// @route  POST /api/journal
// @access Private/Admin
exports.createPost = asyncHandler(async (req, res) => {
  const post = await JournalPost.create(req.body);
  res.status(201).json({ success: true, post });
});

// @desc   Update a post
// @route  PUT /api/journal/:id
// @access Private/Admin
exports.updatePost = asyncHandler(async (req, res) => {
  const post = await JournalPost.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!post) throw new ApiError(404, 'Journal post not found.');
  res.json({ success: true, post });
});

// @desc   Delete a post
// @route  DELETE /api/journal/:id
// @access Private/Admin
exports.deletePost = asyncHandler(async (req, res) => {
  const post = await JournalPost.findByIdAndDelete(req.params.id);
  if (!post) throw new ApiError(404, 'Journal post not found.');
  res.json({ success: true, message: 'Post deleted.' });
});
