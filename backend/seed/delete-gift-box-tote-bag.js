/**
 * delete-gift-box-tote-bag.js
 * ----------------------------
 * One-off cleanup: removes the two product documents whose images point to
 * 'images/embroidery-gift-box.jpg' and 'images/floral-tote-bag.jpg'.
 *
 * WHY THIS EXISTS:
 * These two image files were, byte-for-byte, duplicate copies of two other
 * existing product photos (images/hugging-bears-handkerchief.jpg and
 * images/welcome-home-gold-hoop.jpg respectively) — that's why the Shop page
 * was showing the same photo twice under different product names. The image
 * files have already been deleted from the images/ folder; this script
 * removes the now-orphaned product documents in MongoDB that still point at
 * those filenames, so their (broken/duplicate-looking) cards stop appearing
 * on the Shop page.
 *
 * Matches products by:
 *   - images array containing 'images/embroidery-gift-box.jpg' or
 *     'images/floral-tote-bag.jpg', OR
 *   - exact name "Embroidery Gift Box" / "Floral Tote Bag" (case-insensitive)
 * ...so it catches the product whether it's identified by its image path or
 * its name.
 *
 * USAGE (run from backend/ folder, where .env with MONGO_URI already lives):
 *   node seed/delete-gift-box-tote-bag.js            -> DRY RUN: only lists what it would remove
 *   node seed/delete-gift-box-tote-bag.js --apply    -> actually deletes the matched product(s)
 *
 * SAFE BY DESIGN:
 *   - Never deletes anything unless --apply is passed.
 *   - Prints exactly which product(s) matched — by _id, name, and images — before deleting.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const TARGET_IMAGES = ['images/embroidery-gift-box.jpg', 'images/floral-tote-bag.jpg'];
const TARGET_NAMES = ['embroidery gift box', 'floral tote bag'];

async function main() {
  const apply = process.argv.includes('--apply');

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI not found in environment. Run this from your backend/ folder with your .env present.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.\n');

  const matches = await Product.find({
    $or: [
      { images: { $in: TARGET_IMAGES } },
      { name: { $in: TARGET_NAMES.map((n) => new RegExp(`^${n}$`, 'i')) } }
    ]
  });

  if (matches.length === 0) {
    console.log('No matching products found (nothing to do). If you expected a match, double-check the product name/image path in your DB.');
    await mongoose.disconnect();
    return;
  }

  console.log(`${apply ? 'REMOVING' : 'WOULD REMOVE'} ${matches.length} product(s):`);
  matches.forEach((p) => {
    console.log(`  - ${p._id}  "${p.name}"  [${p.slug}]  images: ${(p.images || []).join(', ') || '(none)'}`);
  });

  if (apply) {
    const ids = matches.map((p) => p._id);
    const result = await Product.deleteMany({ _id: { $in: ids } });
    console.log(`\nDeleted ${result.deletedCount} product document(s).`);
  } else {
    console.log('\nDry run only — nothing was deleted. Re-run with --apply to actually remove these.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});