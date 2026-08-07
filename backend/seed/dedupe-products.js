/**
 * dedupe-products.js
 * -------------------
 * Finds duplicate products in the LIVE MongoDB database (same name/slug,
 * OR different products pointing at the exact same first image) and,
 * on confirmation, removes the extra copies — keeping the OLDEST document
 * of each duplicate group (so existing links/orders that reference it stay
 * valid).
 *
 * WHY THIS EXISTS:
 * The shop page's rendering code (js/main.js) and the API (productController.js)
 * were checked and are NOT the source of duplicate images — they render exactly
 * what's in the database, in order, with no double-rendering. If the shop page
 * shows the same image twice, the duplicate product documents already exist in
 * MongoDB (most likely from an old seed run before the seed script used
 * upsert-by-name, or a manual duplicate insert).
 *
 * USAGE (run from backend/ folder, where .env with MONGO_URI already lives):
 *   node dedupe-products.js            -> DRY RUN: only lists what it would remove
 *   node dedupe-products.js --apply    -> actually deletes the extra duplicates
 *
 * SAFE BY DESIGN:
 *   - Never runs a delete unless --apply is passed.
 *   - Within each duplicate group, always keeps the OLDEST (createdAt) document
 *     and only removes the newer copies.
 *   - Prints exactly what it found/removed so you can review before/after.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product'); // this file lives in backend/seed/, so ../models/Product points to backend/models/Product.js

async function main() {
  const apply = process.argv.includes('--apply');

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI not found in environment. Run this from your backend/ folder with your .env present.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.\n');

  const all = await Product.find({}).sort({ createdAt: 1 }); // oldest first
  console.log(`Total products in DB: ${all.length}\n`);

  // Group 1: exact same name/slug (should be impossible thanks to the unique
  // index on slug, but checked in case the index was ever missing/dropped).
  const byName = groupBy(all, (p) => (p.name || '').trim().toLowerCase());

  // Group 2: different products whose FIRST image file is identical.
  // This is the more likely real-world cause of "duplicate images" — e.g. the
  // same photo re-used across two separately-created product documents.
  const byFirstImage = groupBy(
    all.filter((p) => p.images && p.images.length),
    (p) => p.images[0]
  );

  const toRemove = new Map(); // _id -> product, deduped across both groups

  reportAndCollect('Duplicate NAME/SLUG groups', byName, toRemove);
  reportAndCollect('Duplicate FIRST-IMAGE groups', byFirstImage, toRemove);

  if (toRemove.size === 0) {
    console.log('No duplicates found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\n${apply ? 'REMOVING' : 'WOULD REMOVE'} ${toRemove.size} duplicate product(s):`);
  for (const p of toRemove.values()) {
    console.log(`  - ${p._id}  "${p.name}"  (${(p.images || [])[0] || 'no image'})`);
  }

  if (apply) {
    const ids = Array.from(toRemove.keys());
    const result = await Product.deleteMany({ _id: { $in: ids } });
    console.log(`\nDeleted ${result.deletedCount} duplicate product document(s).`);
  } else {
    console.log('\nDry run only — nothing was deleted. Re-run with --apply to actually remove these.');
  }

  await mongoose.disconnect();
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  // Only keep groups with more than one entry (actual duplicates)
  for (const key of Array.from(map.keys())) {
    if (map.get(key).length < 2) map.delete(key);
  }
  return map;
}

function reportAndCollect(label, groups, toRemove) {
  if (groups.size === 0) {
    console.log(`${label}: none found.`);
    return;
  }
  console.log(`${label}: ${groups.size} group(s) found.`);
  for (const [key, items] of groups.entries()) {
    // items are sorted oldest-first (came from `all` which was sorted that way)
    const [keep, ...extras] = items;
    console.log(`  Key: "${key}"`);
    console.log(`    KEEP   -> ${keep._id}  "${keep.name}"  created ${keep.createdAt}`);
    extras.forEach((p) => {
      console.log(`    REMOVE -> ${p._id}  "${p.name}"  created ${p.createdAt}`);
      toRemove.set(String(p._id), p);
    });
  }
  console.log('');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});