/*
 * Populates MongoDB with the Talking-Thread product catalog (matching the names/prices
 * already hardcoded into shop.html and product.html), an admin account, and a sample
 * journal post. Safe to re-run — it upserts by slug/email so it won't create duplicates.
 *
 * Usage:
 *   npm run seed            (from backend/)
 *   npm run seed:destroy    (wipes products, users, journal posts)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');
const connectDB = require('../config/db');

const Product = require('../models/Product');
const User = require('../models/User');
const JournalPost = require('../models/JournalPost');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');

const products = [
  {
    name: 'Marigold Trellis Heirloom Hoop',
    images: ['images/4.jpg'],
    price: 2450,
    category: 'Wall Art',
    collections: ['Wall Art Hoops', 'Floral Reverie'],
    isFeatured: true,
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'An heirloom marigold trellis, hand-embroidered in antique gold and olive silk on a brass hoop.',
    description:
      'An heirloom trellis of marigold and vine, hand-stitched in antique gold and warm amber silk threads with soft olive vine work, set inside a polished brass hoop. Each piece is made to order in our Jaipur atelier and can be personalised with a short embroidered name or date.',
    sizes: ['Small — 8in', 'Medium — 12in', 'Large — 16in'],
    colors: ['gold', 'sage', 'ivory'],
    tags: ['hoop', 'floral', 'new']
  },
  {
    name: 'Ivory Rose Monogram Heirloom Linen',
    images: ['images/2.jpg'],
    price: 3200,
    category: 'Table Linen',
    collections: ['Monogram Edit', 'Bridal Trousseau'],
    isFeatured: true,
    availability: 'Made to Order',
    shortDescription: 'A dusty-rose monogram bloom, hand-embroidered on pure ivory linen with gold lettering.',
    description:
      'Fine pure ivory linen finished with a hand-embroidered dusty-rose bloom and a custom monogram traced in antique gold thread. A timeless keepsake piece for weddings, anniversaries or a considered gift.',
    sizes: ['Medium — 12in', 'Large — 16in'],
    colors: ['ivory', 'blush', 'gold'],
    tags: ['linen', 'monogram', 'wedding']
  },
  {
    name: 'Jewel Peacock Feather Cushion',
    images: ['images/14.jpg'],
    price: 1850,
    compareAtPrice: 2300,
    category: 'Home',
    collections: ['Floral Reverie'],
    isBestSeller: true,
    availability: 'In Stock',
    shortDescription: 'Jewel-toned peacock feather embroidery in emerald teal and midnight sapphire thread.',
    description:
      'A statement cushion cover featuring a hand-embroidered peacock feather worked in emerald teal, midnight sapphire and antique gold thread, backed with soft natural linen.',
    sizes: ['Medium — 12in', 'Large — 16in'],
    colors: ['midnight', 'sage', 'gold'],
    tags: ['cushion', 'peacock', 'best seller']
  },
  {
    name: 'Blush Bloom Trailing Table Runner',
    images: ['images/3.jpg'],
    price: 4100,
    category: 'Table Linen',
    collections: ['Table & Linen', 'Festive Table'],
    availability: 'Made to Order',
    shortDescription: 'A trailing bloom in blush rose and sage, hand-embroidered along a fine linen runner.',
    description:
      'A long table runner in soft linen, hand-embroidered with a trailing bloom motif in blush rose and sage-green thread, finished with fine antique gold detailing along both ends. Made for everyday dining or special occasions.',
    sizes: ['Medium — 12in', 'Large — 16in'],
    colors: ['blush', 'sage', 'gold'],
    tags: ['runner', 'floral', 'dining']
  },
  {
    name: 'Midnight Vine Statement Hoop',
    images: ['images/13.jpg'],
    price: 2750,
    category: 'Wall Art',
    collections: ['Wall Art Hoops'],
    isFeatured: true,
    availability: 'Made to Order',
    shortDescription: 'A dramatic vine in midnight indigo and antique gold thread, framed on a statement hoop.',
    description:
      'A dramatic vine and leaf design hand-stitched in deep midnight-indigo and antique gold thread on a large wooden hoop, designed to be framed as wall art.',
    sizes: ['Small — 8in', 'Medium — 12in', 'Large — 16in'],
    colors: ['midnight', 'gold'],
    tags: ['hoop', 'wall art', 'botanical']
  },
  {
    name: 'Sage Leaf Heirloom Baby Blanket',
    images: ['images/6.jpg'],
    price: 2950,
    category: 'Kidswear',
    collections: ['Little Ones'],
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'Soft cotton baby blanket with hand-embroidered sage leaf border.',
    description:
      'A generously sized cotton baby blanket finished with a delicate hand-embroidered leaf border in sage green. Can be personalised with baby\'s name.',
    sizes: ['Medium — 12in'],
    colors: ['sage', 'ivory', 'blush'],
    tags: ['baby', 'blanket', 'gift', 'new']
  },
  {
    name: 'Antique Gold Paisley Clutch',
    images: ['images/18.jpg'],
    price: 3600,
    category: 'Accessories',
    collections: ['Everyday Carry'],
    availability: 'In Stock',
    shortDescription: 'Hand-embroidered paisley clutch in antique gold thread.',
    description:
      'A structured evening clutch hand-embroidered with a classic paisley motif in antique gold thread on deep wine silk, lined and finished with a magnetic clasp.',
    sizes: ['Medium — 12in'],
    colors: ['gold', 'maroon'],
    tags: ['clutch', 'paisley', 'accessory']
  },
  {
    name: 'Blossom Trail Silk Scarf',
    images: ['images/22.jpg'],
    price: 2200,
    compareAtPrice: 2650,
    category: 'Accessories',
    collections: ['Everyday Carry'],
    isBestSeller: true,
    availability: 'In Stock',
    shortDescription: 'Lightweight silk scarf with a trailing blossom embroidery.',
    description:
      'A lightweight silk scarf finished with a delicate hand-embroidered blossom trail along one edge — an easy layer for any season.',
    sizes: ['Medium — 12in'],
    colors: ['blush', 'sage', 'gold'],
    tags: ['scarf', 'floral', 'accessory', 'best seller']
  },
  {
    name: 'Terracotta Songbird Hoop',
    images: ['images/9.jpg'],
    price: 2300,
    category: 'Wall Art',
    collections: ['Wall Art Hoops'],
    availability: 'Made to Order',
    shortDescription: 'A perched songbird motif in warm terracotta and gold thread.',
    description:
      'A charming songbird perched among leaves, hand-embroidered in warm terracotta and gold thread on a 12in wooden hoop.',
    sizes: ['Small — 8in', 'Medium — 12in'],
    colors: ['maroon', 'gold'],
    tags: ['hoop', 'bird', 'nature']
  }
];

const journalPosts = [
  {
    title: 'Notes From The Studio: How We Choose Our Thread Colours',
    excerpt:
      'A short look at how our artisans hand-mix and select thread palettes for every new Talking-Thread piece.',
    content:
      'Every Talking-Thread motif begins with a palette pinned to the studio wall in Jaipur. Our artisans work through dozens of thread combinations before settling on the handful that make it into a finished piece — balancing traditional Rajasthani colourways with a softer, modern hand. This post walks through that process, from raw silk thread to the finished hoop.',
    author: 'Ritik Parihar',
    tags: ['studio', 'craft'],
    isPublished: true
  }
];

async function seed() {
  await connectDB();

  const destroy = process.argv.includes('--destroy');

  if (destroy) {
    await Promise.all([
      Product.deleteMany({}),
      JournalPost.deleteMany({}),
      User.deleteMany({ role: 'admin' })
    ]);
    console.log('Destroyed products, journal posts and admin users.');
    await mongoose.disconnect();
    return;
  }

  // Upsert products by name so re-running the seed is idempotent.
  // NOTE: findOneAndUpdate never triggers Mongoose's document-level pre('validate')
  // hooks, so we must generate the slug here ourselves — otherwise every upserted
  // product would be inserted with slug: null and collide with the unique index.
  for (const p of products) {
    const doc = { ...p, slug: slugify(p.name, { lower: true, strict: true }) };
    await Product.findOneAndUpdate({ name: p.name }, doc, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  console.log(`Seeded ${products.length} products.`);

  for (const post of journalPosts) {
    const postDoc = { ...post, slug: slugify(post.title, { lower: true, strict: true }) };
    await JournalPost.findOneAndUpdate({ title: post.title }, postDoc, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    });
  }
  console.log(`Seeded ${journalPosts.length} journal post(s).`);

  // Bootstrap an admin account from env vars, if it doesn't already exist
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@talking-thread.com').toLowerCase();
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const admin = await User.create({
      name: process.env.ADMIN_NAME || 'Studio Admin',
      email: adminEmail,
      password: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
      role: 'admin'
    });
    await Cart.create({ user: admin._id, items: [] });
    await Wishlist.create({ user: admin._id, items: [] });
    console.log(`Created admin account: ${adminEmail} (password from .env — change it after first login)`);
  } else {
    console.log(`Admin account already exists: ${adminEmail}`);
  }

  await mongoose.disconnect();
  console.log('Seeding complete.');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});