const fs = require('fs');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Upload = require('../models/Upload');

// Legacy support only: some existing Product/Category documents still hold
// paths like "images/hoop-abc123.jpg" from BEFORE this file stored uploads in
// MongoDB (see the comment on models/Upload.js for why that changed). Photos
// uploaded going forward never touch this folder, but deleteImage() below
// still knows how to clean up an old disk-based entry if someone removes one.
const IMAGES_DIR = path.join(__dirname, '..', '..', 'images');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per photo

// @desc   Accept one image as a data URL and store it in MongoDB
// @route  POST /api/uploads/image
// @access Private/Admin
exports.uploadImage = asyncHandler(async (req, res) => {
  const { dataUrl } = req.body || {};

  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new ApiError(400, 'No image was received. Please choose a photo and try again.');
  }

  const match = dataUrl.match(/^data:([a-z0-9/+.-]+);base64,(.+)$/i);
  if (!match) throw new ApiError(400, 'That file could not be read as an image.');

  const mime = match[1].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new ApiError(400, 'Please upload a JPG, PNG or WebP image.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new ApiError(400, 'That image appears to be empty.');
  if (buffer.length > MAX_BYTES) {
    throw new ApiError(413, 'That photo is larger than 8 MB — please use a smaller version.');
  }

  const doc = await Upload.create({ mimeType: mime, data: buffer });

  // Relative-from-root on purpose — the front end stores exactly this on
  // Product.images / Category.image and the existing card/detail renderers
  // already resolve any string that looks like a path, so nothing else in
  // the front end needs to change.
  const url = `/api/uploads/${doc._id}`;

  res.status(201).json({
    success: true,
    path: url,
    url,
    id: String(doc._id),
    bytes: buffer.length
  });
});

// @desc   Serve a previously uploaded image by its Mongo id
// @route  GET /api/uploads/:id
// @access Public
exports.getImage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new ApiError(404, 'Image not found.');

  const doc = await Upload.findById(id).select('mimeType data');
  if (!doc) throw new ApiError(404, 'Image not found.');

  // Every uploadImage response is a brand-new id — an id can never point to
  // different bytes later — so this is safe to cache aggressively forever,
  // the same guarantee the old disk-based /images route relied on.
  res.set('Content-Type', doc.mimeType);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(doc.data);
});

// @desc   Delete a previously uploaded image (DB-stored, or a legacy disk file)
// @route  DELETE /api/uploads/image?path=/api/uploads/<id>
// @access Private/Admin
exports.deleteImage = asyncHandler(async (req, res) => {
  const raw = String(req.query.path || '');
  const last = raw.split('/').filter(Boolean).pop() || '';

  // New-style entry: "/api/uploads/<mongo id>" — delete the MongoDB document.
  if (/^[a-f0-9]{24}$/i.test(last)) {
    await Upload.findByIdAndDelete(last).catch(() => {});
    return res.json({ success: true, message: 'Image removed.' });
  }

  // Legacy entry: "images/<file>.jpg" — delete the old disk file, same as before.
  const name = path.basename(last);
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name === '.' || name === '..') {
    throw new ApiError(400, 'Invalid image path.');
  }
  const target = path.join(IMAGES_DIR, name);
  try {
    await fs.promises.unlink(target);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err; // already gone is the desired end state
  }
  res.json({ success: true, message: 'Image removed.' });
});