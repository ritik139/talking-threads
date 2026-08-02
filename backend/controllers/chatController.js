const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { askGemini } = require('../lib/gemini');
const { buildSystemPrompt } = require('../lib/knowledge');

const MAX_MESSAGE_LENGTH = 800;
const MAX_HISTORY_TURNS = 8; // user+assistant pairs kept from the client-sent history
const PRODUCT_CONTEXT_LIMIT = 6;

function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  const cleaned = [];
  for (const turn of rawHistory) {
    if (!turn || typeof turn !== 'object') continue;
    const role = turn.role === 'assistant' ? 'assistant' : turn.role === 'user' ? 'user' : null;
    const content = typeof turn.content === 'string' ? turn.content.slice(0, MAX_MESSAGE_LENGTH) : null;
    if (!role || !content) continue;
    cleaned.push({ role, content });
  }
  // Keep only the most recent turns to bound prompt size/cost.
  return cleaned.slice(-MAX_HISTORY_TURNS * 2);
}

// Live product lookup grounded to the customer's message — MongoDB $text search first
// (name/description/tags index, see models/Product.js), falling back to a general
// featured/best-seller set so the bot always has *something* real to point to.
async function findRelevantProducts(message) {
  try {
    const textResults = await Product.find(
      { isActive: true, $text: { $search: message } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(PRODUCT_CONTEXT_LIMIT)
      .lean();
    if (textResults.length) return textResults;
  } catch (err) {
    // $text throws if the query has no indexable terms (e.g. only stopwords/punctuation) — fall through.
  }

  return Product.find({ isActive: true, $or: [{ isFeatured: true }, { isBestSeller: true }] })
    .sort('-isBestSeller -isFeatured -createdAt')
    .limit(PRODUCT_CONTEXT_LIMIT)
    .lean();
}

async function findOrderContext(user) {
  if (!user) return [];
  return Order.find({ user: user._id }).sort('-createdAt').limit(5).lean();
}

// @desc   AI support chat — grounds replies in live product/order data, then asks Gemini
// @route  POST /api/chat
// @access Public (optionalAuth: uses the signed-in cookie if present, for order questions)
exports.chat = asyncHandler(async (req, res) => {
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message) throw new ApiError(400, 'Message is required.');
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new ApiError(400, `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
  }

  const history = sanitizeHistory(req.body.history);

  const [products, orders] = await Promise.all([
    findRelevantProducts(message),
    findOrderContext(req.user)
  ]);

  const systemPrompt = buildSystemPrompt({ products, user: req.user, orders });

  let reply;
  try {
    reply = await askGemini({ systemPrompt, history, userMessage: message });
  } catch (err) {
    console.error('Chat AI error:', err.message);
    throw new ApiError(502, 'The assistant is temporarily unavailable.');
  }

  if (!reply) {
    throw new ApiError(502, 'The assistant is temporarily unavailable.');
  }

  res.json({ success: true, reply });
});

// true