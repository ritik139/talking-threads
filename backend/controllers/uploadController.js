const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// Images live in the same /images folder the rest of the site already serves
// (see server.js's express.static mount), so an uploaded photo is reachable at
// exactly the same kind of path as the seeded ones: images/<file>.jpg
const IMAGES_DIR = path.join(__dirname, '..', '..', 'images');

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif'
};

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per photo

function safeBaseName(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')      // drop any extension the browser sent
    .replace(/[^a-z0-9]+/g, '-')        // no slashes, dots or spaces survive → no path traversal
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'photo';
}

// @desc   Accept one image as a data URL and write it into /images
// @route  POST /api/uploads/image
// @access Private/Admin
exports.uploadImage = asyncHandler(async (req, res) => {
  const { dataUrl, filename } = req.body || {};

  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new ApiError(400, 'No image was received. Please choose a photo and try again.');
  }

  const match = dataUrl.match(/^data:([a-z0-9/+.-]+);base64,(.+)$/i);
  if (!match) throw new ApiError(400, 'That file could not be read as an image.');

  const mime = match[1].toLowerCase();
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    throw new ApiError(400, 'Please upload a JPG, PNG or WebP image.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new ApiError(400, 'That image appears to be empty.');
  if (buffer.length > MAX_BYTES) {
    throw new ApiError(413, 'That photo is larger than 8 MB — please use a smaller version.');
  }

  await fs.promises.mkdir(IMAGES_DIR, { recursive: true });

  // A short random suffix keeps two uploads called "hoop.jpg" from overwriting
  // each other, and means a replaced photo gets a brand-new URL (so no browser
  // or CDN can serve the previous image from cache).
  const base = safeBaseName(filename);
  const name = `${base}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

  await fs.promises.writeFile(path.join(IMAGES_DIR, name), buffer);

  res.status(201).json({
    success: true,
    // Relative on purpose — the front end stores exactly this on Product.images
    // and the existing card/detail renderers already resolve it.
    path: `images/${name}`,
    url: `/images/${name}`,
    bytes: buffer.length
  });
});

// @desc   Delete an uploaded image
// @route  DELETE /api/uploads/image?path=images/foo.jpg
// @access Private/Admin
exports.deleteImage = asyncHandler(async (req, res) => {
  const name = path.basename(String(req.query.path || ''));

  // basename() already strips directories, but it happily returns ".." for an
  // input of "..", which would resolve to the folder ABOVE /images. Require a
  // plain filename so only a real uploaded file can ever be the target.
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name === '.' || name === '..') {
    throw new ApiError(400, 'Invalid image path.');
  }

  const target = path.join(IMAGES_DIR, name);

  try {
    await fs.promises.unlink(target);
  } catch (err) {
    // Already gone is the desired end state, so treat it as success.
    if (err.code !== 'ENOENT') throw err;
  }

  res.json({ success: true, message: 'Image removed.' });
});