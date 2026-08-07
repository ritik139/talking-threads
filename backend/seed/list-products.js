/**
 * list-products.js
 * -----------------
 * Prints every product's name + image(s), sorted by image — so if two
 * DIFFERENT-named products are using the exact same image file, they'll
 * land right next to each other in the list and be easy to spot.
 *
 * USAGE (run from backend/ folder):
 *   node seed/list-products.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI not found in environment.');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const all = await Product.find({}).select('name images slug createdAt').lean();
  console.log(`Total products: ${all.length}\n`);

  // Sort by first image so duplicates sit next to each other
  all.sort((a, b) => {
    const ai = (a.images && a.images[0]) || '';
    const bi = (b.images && b.images[0]) || '';
    return ai.localeCompare(bi);
  });

  all.forEach((p) => {
    console.log(`${(p.images && p.images[0]) || '(no image)'}  ->  "${p.name}"  [${p.slug}]`);
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});