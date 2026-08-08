/*
 * Populates MongoDB with the Talking-Thread product catalog (matching the names/prices
 * already hardcoded into shop.html and product.html) and an admin account.
 * Safe to re-run — it upserts by slug/email so it won't create duplicates.
 *
 * Usage:
 *   npm run seed            (from backend/)
 *   npm run seed:destroy    (wipes products and users)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');
const connectDB = require('../config/db');

const Product = require('../models/Product');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');

const products = [
  {
    // Photo: hoop reading "Welcome, our little miracle", baby name, birth time/weight/date,
    // and hand-embroidered elephant, monkey, giraffe and baby motifs with a pearl trim.
    name: 'Baby Birth Announcement Embroidery Hoop',
    images: ['images/baby-birth-hoop.jpg'],
    price: 1300,
    category: ['Wall Art', 'Kidswear'],
    collections: ['Wall Art Hoops', 'Little Ones'],
    isFeatured: true,
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A pearl-trimmed hoop hand-embroidered with baby birth details and cute animal motifs.',
    description:
      'A hand-embroidered baby birth announcement hoop finished with a pearl trim, featuring space for the baby\'s name, birth date, time and weight alongside a hand-stitched elephant, monkey, giraffe and baby motif. Made to order in our Jaipur atelier and personalised with your own birth details.',
    sizes: ['Small — 8in', 'Medium — 12in', 'Large — 16in'],
    colors: ['gold', 'sage', 'ivory'],
    tags: ['baby hoop', 'birth announcement hoop', 'baby milestone embroidery hoop', 'nursery hoop', 'new baby gift', 'personalized hoop']
  },
  {
    // Photo: hoop with an illustrated couple holding hands, hearts, and the handwritten
    // quote "With my whole heart, for my whole life" above an embroidered infinity symbol.
    name: 'Couple Love Quote Embroidery Hoop',
    images: ['images/couple-love-hoop.jpg'],
    price: 599,
    category: ['Wall Art', 'Kidswear'],
    collections: ['Wall Art Hoops', 'Bridal Trousseau'],
    isFeatured: true,
    availability: 'Made to Order',
    shortDescription: 'A hoop hand-embroidered with an illustrated couple, hearts and a handwritten love quote.',
    description:
      'A wooden embroidery hoop featuring a hand-stitched illustrated couple holding hands, surrounded by little hearts, the handwritten quote "With my whole heart, for my whole life" and an embroidered infinity symbol. A keepsake gift for anniversaries, weddings or engagements.',
    sizes: ['Medium — 12in', 'Large — 16in'],
    colors: ['ivory', 'blush', 'gold'],
    tags: ['couple hoop', 'love quote embroidery hoop', 'anniversary gift', 'engagement gift', 'wedding gift hoop']
  },
  {
    // Photo: a small folded white cotton cloth held in a hand, embroidered with two
    // hugging bear cubs and hearts.
    name: 'Hugging Bears Embroidered Handkerchief',
    images: ['images/hugging-bears-handkerchief.jpg'],
    price: 299,
    category: ['Kidswear'],
    collections: ['Everyday Carry', 'Little Ones'],
    availability: 'Made to Order',
    shortDescription: 'A soft cotton handkerchief hand-embroidered with two hugging bear cubs and hearts.',
    description:
      'A soft white cotton handkerchief finished with a hand-embroidered design of two hugging bear cubs and little hearts. A pocket-sized, thoughtful gift for a partner, friend or new parent.',
    sizes: ['Small — 8in'],
    colors: ['ivory', 'blush'],
    tags: ['embroidered handkerchief', 'bear embroidery', 'cute gift', 'pocket cloth', 'hand-embroidered gift']
  },
  {
    // Photo: heart-shaped floral wreath hoop with tassels ("Welcome home heena").
    // This is now the single listing for this design — the near-duplicate
    // "Welcome Home Floral Heart Embroidery Hoop" (images/14.jpg) was removed
    // from the catalog since it was the same piece/photo as this one.
    name: 'Welcome Home Floral Heart Embroidery Hoop with Tassels',
    images: ['images/welcome-home-hoop.jpg'],
    price: 1799,
    category: ['Wall Art', 'Accessories'],
    collections: ['Wall Art Hoops', 'Floral Reverie'],
    isFeatured: true,
    availability: 'Made to Order',
    shortDescription: 'A larger tasseled hoop hand-embroidered with a floral heart wreath and a "Welcome Home" message.',
    description:
      'A hanging hoop hand-embroidered with a heart-shaped wreath of roses in maroon, blush and gold thread, personalised with a "Welcome Home" message, a name and a date, finished with a bow and a fringe of beaded maroon-and-gold tassels.',
    sizes: ['Small — 8in', 'Medium — 12in', 'Large — 16in'],
    colors: ['maroon', 'gold', 'blush'],
    tags: ['welcome home hoop', 'floral heart wreath hoop', 'housewarming gift', 'tasseled hoop', 'personalized hoop']
  },
  {
    // Photo: hoop reading "[Couple names] — Griha Pravesh" in Hindi/English with a
    // rose garland border in pink, coral and yellow, set against a housewarming backdrop.
    name: 'Griha Pravesh Housewarming Embroidery Hoop',
    images: ['images/housewarming-hoop.jpg'],
    price: 1350,
    category: ['Wall Art'],
    collections: ['Wall Art Hoops', 'Floral Reverie'],
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A hoop hand-embroidered with a couple\'s names, "Griha Pravesh" text and a rose garland border.',
    description:
      'A pearl-trimmed embroidery hoop hand-stitched with a couple\'s names, the Hindi text "Griha Pravesh" (housewarming) and a date, framed by a garland of rose blooms in pink, coral and yellow thread. A traditional keepsake for a housewarming ceremony.',
    sizes: ['Medium — 12in', 'Large — 16in'],
    colors: ['blush', 'gold', 'sage'],
    tags: ['griha pravesh hoop', 'housewarming gift', 'new home hoop', 'rose garland hoop', 'personalized hoop']
  },
  {
    // Photo: hoop with a house icon, "Griha Pravesh" text, a pink/blue floral wreath,
    // two names ("Ishvik", "Shridha") and "A sweet new beginning".
    name: 'Griha Pravesh New Home Embroidery Hoop',
    images: ['images/new-home-hoop.jpg'],
    price: 1700,
    compareAtPrice: 2650,
    category: ['Wall Art'],
    collections: ['Wall Art Hoops', 'Floral Reverie'],
    isBestSeller: true,
    availability: 'In Stock',
    shortDescription: 'A hoop hand-embroidered with a house motif, "Griha Pravesh" text and a floral wreath.',
    description:
      'A pearl-trimmed embroidery hoop hand-stitched with a little house motif, the text "Griha Pravesh" (new home), two names, the message "A sweet new beginning" and a date, framed by a wreath of pink and blue flowers.',
    sizes: ['Medium — 12in'],
    colors: ['blush', 'gold', 'sage'],
    tags: ['griha pravesh hoop', 'new home gift', 'housewarming hoop', 'floral wreath hoop', 'personalized hoop']
  },
  {
    // Photo: hoop reading "Welcome prince Ishvik", with birth time/weight/date,
    // parents' names, and hand-stitched elephant, monkey and baby-boy motifs.
    name: 'Baby Welcome Embroidery Hoop',
    images: ['images/baby-welcome-hoop.jpg'],
    price: 1250,
    category: ['Wall Art', 'Kidswear'],
    collections: ['Wall Art Hoops', 'Little Ones'],
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A hand-embroidered hoop announcing a new arrival, personalised with name, date and birth details.',
    description:
      'A wooden embroidery hoop hand-stitched to welcome a new baby boy, personalised with his name, birth time, date and weight, alongside hand-embroidered elephant, monkey and baby motifs. A keepsake gift for new parents, made to order in our Jaipur atelier.',
    sizes: ['Small — 8in', 'Medium — 12in'],
    colors: ['ivory', 'multicolour'],
    tags: ['baby birth hoop', 'newborn announcement hoop', 'welcome baby hoop', 'personalized baby gift', 'new baby embroidery hoop']
  },
  {
    // Photo: heart-shaped floral wreath hoop with gold-and-white tassels,
    // reading "Welcome home aesha" with a hand-date, hung against a plain wall.
    name: 'Welcome Home Floral Heart Embroidery Hoop (Gold Tassels)',
    images: ['images/welcome-home-gold-hoop.jpg'],
    price: 1499,
    category: ['Wall Art'],
    collections: ['Wall Art Hoops', 'Floral Reverie'],
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A heart-shaped floral wreath hoop with gold tassels, personalised with a name and date.',
    description:
      'A wooden embroidery hoop hand-stitched into a heart-shaped floral wreath, personalised with a name and date, finished with gold-and-white tasseled trim. A warm housewarming or homecoming gift, made to order in our Jaipur atelier.',
    sizes: ['Medium — 10in'],
    colors: ['ivory', 'gold', 'blush'],
    tags: ['welcome home hoop', 'floral heart hoop', 'housewarming gift hoop', 'personalized hoop', 'tasseled embroidery hoop']
  },
  {
    // Photo: a folded white cotton handkerchief held in a hand, hand-embroidered
    // with a peacock-feather-and-flute motif and a devotional Krishna quote.
    name: 'Krishna Quote Embroidered Handkerchief',
    images: ['images/krishna-quote-handkerchief.jpg'],
    price: 340,
    category: ['Kidswear'],
    collections: ['Everyday Carry'],
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A cotton handkerchief hand-embroidered with a peacock feather and a devotional Krishna quote.',
    description:
      'A soft cotton handkerchief hand-embroidered with a peacock feather and flute motif alongside a comforting devotional line about Krishna. A small, meaningful keepsake, made to order in our Jaipur atelier.',
    colors: ['white'],
    tags: ['krishna handkerchief', 'devotional embroidery', 'spiritual gift', 'embroidered handkerchief', 'peacock feather embroidery']
  },
  {
    // Photo: cream hoodie with a hand-embroidered panda motif on the chest.
    name: 'Panda Embroidered Hoodie',
    images: ['images/panda-embroidered-hoodie.jpg'],
    price: 1299,
    category: ['Clothing'],
    collections: ['Everyday Carry', 'Kids & Playful'],
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A cotton hoodie finished with a hand-embroidered panda motif on the chest.',
    description:
      'A soft cotton hoodie finished with a hand-embroidered panda motif on the chest. A playful, cozy piece made to order in our Jaipur atelier — a fun gift for kids or panda lovers of any age.',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['cream', 'grey'],
    tags: ['embroidered hoodie', 'panda hoodie', 'custom hoodie', 'handmade clothing', 'cotton hoodie']
  },
  {
    // Photo: hand holding a folded white cloth embroidered with a large monogram
    // letter "A" surrounded by small flowers, and a name below it.
    name: 'Personalized Monogram Letter Handkerchief',
    images: ['images/monogram-letter-cloth.jpg'],
    price: 299,
    category: ['Kidswear', 'Accessories'],
    collections: ['Everyday Carry', 'Personalised Keepsakes'],
    isFeatured: true,
    availability: 'Made to Order',
    shortDescription: 'A cotton handkerchief hand-embroidered with a large monogram letter, flowers and a name.',
    description:
      'A soft cotton handkerchief hand-embroidered with a large monogram initial framed by a small floral spray, personalised with a name below. A simple, elegant keepsake made to order in our Jaipur atelier.',
    sizes: ['Small — 8in'],
    colors: ['ivory'],
    tags: ['monogram handkerchief', 'personalized initial cloth', 'embroidered monogram', 'name embroidery', 'hand-embroidered gift']
  },
  {
    // Photo: hand holding a folded white handkerchief embroidered with a penguin
    // holding a red heart balloon, initials and a "Special" date.
    name: 'Penguin Balloon Embroidered Handkerchief',
    images: ['images/penguin-balloon-handkerchief.jpg'],
    price: 370,
    category: ['Kidswear'],
    collections: ['Everyday Carry', 'Kids & Playful'],
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A cotton handkerchief hand-embroidered with a penguin holding a heart balloon and a special date.',
    description:
      'A soft cotton handkerchief hand-embroidered with a cheerful penguin holding a red heart balloon, personalised with initials and a special date. A sweet, pocket-sized keepsake made to order in our Jaipur atelier.',
    sizes: ['Small — 8in'],
    colors: ['ivory'],
    tags: ['penguin handkerchief', 'embroidered handkerchief', 'cute gift', 'personalized date embroidery', 'pocket cloth']
  },
  {
    // Photo: round hoop with a couple's names, "together forever", a hand-embroidered
    // May calendar, and a miniature bride-and-groom fabric figure in a red lehenga.
    name: 'Wedding Save-the-Date Calendar Embroidery Hoop',
    images: ['images/wedding-calendar-hoop.jpg'],
    price: 1399,
    category: ['Wall Art'],
    collections: ['Wall Art Hoops', 'Bridal Trousseau'],
    isFeatured: true,
    availability: 'Made to Order',
    shortDescription: 'A hoop hand-embroidered with a couple\'s names, a save-the-date calendar and a miniature bridal figure.',
    description:
      'A pearl-trimmed embroidery hoop hand-stitched with a couple\'s names, a floral wreath, a hand-embroidered save-the-date calendar with the wedding day marked, and a detailed miniature bride-and-groom fabric figure in festive attire. A statement keepsake for weddings and engagements.',
    sizes: ['Large — 16in'],
    colors: ['ivory', 'red', 'gold'],
    tags: ['wedding hoop', 'save the date embroidery', 'bridal hoop', 'wedding calendar hoop', 'personalized wedding gift']
  },
  {
    // Photo: round hoop on a stand reading "Welcome Home [name]" with a date and a
    // rose-and-leaf vine wreath in red and green thread.
    name: 'Welcome Home Rose Embroidery Hoop',
    images: ['images/welcome-home-rose-hoop.jpg'],
    price: 800,
    category: ['Wall Art'],
    collections: ['Wall Art Hoops', 'Floral Reverie'],
    availability: 'Made to Order',
    shortDescription: 'A hoop hand-embroidered with a "Welcome Home" message, a name, a date and a rose vine wreath.',
    description:
      'A pearl-trimmed embroidery hoop hand-stitched with a "Welcome Home" message, a name and a date, framed by a hand-embroidered vine wreath of little rose blooms and leaves in red and green thread. A warm homecoming or housewarming keepsake, made to order in our Jaipur atelier.',
    sizes: ['Medium — 12in', 'Large — 16in'],
    colors: ['ivory', 'red', 'sage'],
    tags: ['welcome home hoop', 'rose wreath hoop', 'housewarming gift', 'personalized hoop', 'homecoming gift']
  },
  {
    // Photo: white button-down shirt hand-embroidered on the chest with a fine-line
    // sketch of a father and daughter sharing a tender moment.
    name: 'Father-Daughter Sketch Embroidered Shirt',
    images: ['images/embroidered-shirt-sketch-sample.jpg'],
    price: 1500,
    category: ['Clothing', 'Accessories'],
    collections: ['Everyday Carry', 'Personalised Keepsakes'],
    isFeatured: true,
    availability: 'Made to Order',
    shortDescription: 'A cotton shirt hand-embroidered with a fine-line sketch of a father and daughter moment.',
    description:
      'A crisp white cotton shirt finished with a hand-embroidered fine-line sketch on the chest, capturing a tender father-daughter moment. A heartfelt, wearable keepsake made to order in our Jaipur atelier — a lovely gift for Father\'s Day or any occasion worth stitching into memory.',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['white'],
    tags: ['embroidered shirt', 'father daughter gift', 'sketch embroidery', 'custom shirt', 'handmade clothing']
  },
  {
    // Photo: white shirt collar and placket hand-embroidered with "I Love You"
    // down the button line and a "you (heart) me, forever & always" script quote
    // on the pocket, with a name on the underside of the collar.
    name: 'I Love You Script Embroidered Shirt',
    images: ['images/embroidered-shirt-unbranded-sample.jpg'],
    price: 1500,
    category: ['Clothing'],
    collections: ['Everyday Carry', 'Personalised Keepsakes'],
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A cotton shirt hand-embroidered with an "I Love You" button placket and a script love quote.',
    description:
      'A soft white cotton shirt hand-embroidered with "I Love You" running down the button placket and a handwritten-style "you & me, forever & always" quote with a little heart on the pocket, personalised with a name on the inside collar. A sentimental, made-to-order gift for a partner.',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['white'],
    tags: ['embroidered shirt', 'love quote embroidery', 'personalized shirt', 'anniversary gift', 'handmade clothing']
  },
  {
    // Photo: hoop reading "Welcome Home Bhabhi" with a date, hand-embroidered rose and
    // leaf vine border, pearl trim and red-and-white yarn tassels.
    name: 'Welcome Home Bhabhi Embroidery Hoop',
    images: ['images/welcome-home-bhabhi-hoop.jpg'],
    price: 1300,
    category: ['Wall Art'],
    collections: ['Wall Art Hoops'],
    isFeatured: true,
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A pearl-trimmed hoop hand-embroidered with a "Welcome Home Bhabhi" message and rose vine border, finished with red-and-white tassels.',
    description:
      'A hand-embroidered hoop reading "Welcome Home Bhabhi" with a personalised date, framed by a hand-stitched rose and leaf vine border and a pearl trim, finished with a cascade of red-and-white yarn tassels. Made to order in our Jaipur atelier — a warm keepsake to welcome a new bhabhi home.',
    sizes: ['Medium — 12in', 'Large — 16in'],
    colors: ['maroon', 'ivory'],
    tags: ['welcome home hoop', 'bhabhi gift', 'housewarming gift', 'tasseled hoop', 'personalized hoop']
  },
  {
    // Photo: hoop reading "Welcome home [baby name]" with birth date and "blessed parents"
    // message, hand-embroidered jungle animal appliques (giraffe, monkey, lion, elephant)
    // and leaf vines, pearl trim, no tassels.
    name: 'Welcome Home Baby Jungle Animals Embroidery Hoop',
    images: ['images/welcome-home-radhya-hoop.jpg'],
    price: 1299,
    category: ['Wall Art', 'Kidswear'],
    collections: ['Wall Art Hoops', 'Little Ones'],
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A pearl-trimmed hoop hand-embroidered with a baby welcome message and cute jungle animal appliques.',
    description:
      'A hand-embroidered hoop reading "Welcome Home [baby\'s name]" with the birth date and parents\' names, framed by hand-appliqued jungle animals — a giraffe, monkey, lion and elephant — and leafy vines, finished with a pearl trim. Made to order in our Jaipur atelier and personalised with your baby\'s name and details.',
    sizes: ['Medium — 12in', 'Large — 16in'],
    colors: ['ivory', 'sage'],
    tags: ['baby hoop', 'welcome home hoop', 'jungle animal embroidery', 'new baby gift', 'personalized hoop']
  },
  {
    // Photo: hoop reading "गृह प्रवेश" (Griha Pravesh) with a small house motif, a rose and
    // leaf vine border in maroon and gold, pearl trim and a cascade of maroon yarn tassels.
    name: 'Griha Pravesh Tasseled Embroidery Hoop',
    images: ['images/griha-pravesh-tassel-hoop.jpg'],
    price: 1650,
    category: ['Wall Art'],
    collections: ['Wall Art Hoops', 'Floral Reverie'],
    isNewArrival: true,
    availability: 'Made to Order',
    shortDescription: 'A pearl-trimmed hoop hand-embroidered with a "Griha Pravesh" house motif and rose vine border, finished with maroon tassels.',
    description:
      'A hand-embroidered hoop reading "गृह प्रवेश" (Griha Pravesh) with a hand-stitched house motif, personalised with a date, framed by a rose and leaf vine border in maroon and gold thread with a pearl trim, finished with a cascade of maroon yarn tassels. Made to order in our Jaipur atelier for a new home\'s housewarming.',
    sizes: ['Medium — 12in', 'Large — 16in'],
    colors: ['maroon', 'gold'],
    tags: ['griha pravesh hoop', 'housewarming gift', 'tasseled hoop', 'personalized hoop', 'new home gift']
  }
];

async function seed() {
  await connectDB();

  const destroy = process.argv.includes('--destroy');

  if (destroy) {
    await Promise.all([
      Product.deleteMany({}),
      User.deleteMany({ role: 'admin' })
    ]);
    console.log('Destroyed products and admin users.');
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

  // One-time cleanup: "Welcome Home Floral Heart Embroidery Hoop" (images/14.jpg) was
  // removed from the products array above because it duplicated the same design/photo
  // as "Welcome Home Floral Heart Embroidery Hoop with Tassels" (images/welcome-home-hoop.jpg). Upserting
  // the array above never deletes anything, so on a database that was seeded before this
  // change, the retired product would otherwise keep existing and keep showing up (and
  // keep being served by the API) even though it's no longer in the source list. Deleting
  // it explicitly here — by its exact former name, not by image, so this can never touch
  // an unrelated product — makes re-running the seed actually retire it everywhere.
  const retired = await Product.deleteOne({ name: 'Welcome Home Floral Heart Embroidery Hoop' });
  if (retired.deletedCount) console.log('Removed retired duplicate product: Welcome Home Floral Heart Embroidery Hoop.');

  // One-time cleanup: products photographed with images/18.jpg, images/9.jpg or
  // images/21.jpg were pulled from the catalog above, but (same reasoning as the
  // block just above) the upsert loop never deletes anything — so on any database
  // that was seeded before this change, those old product documents would keep
  // existing and keep being served by the API/appearing on the site after a refresh,
  // even though their images are no longer part of the source list. Deleting them
  // explicitly here, matched by the exact retired image paths (never by name, so this
  // can't accidentally touch an unrelated product that happens to share a name),
  // makes re-running the seed actually retire them everywhere, including live Atlas.
  const retiredByImage = await Product.deleteMany({
    images: { $in: ['images/18.jpg', 'images/9.jpg', 'images/21.jpg'] }
  });
  if (retiredByImage.deletedCount) {
    console.log(`Removed ${retiredByImage.deletedCount} retired product(s) using images/18.jpg, images/9.jpg or images/21.jpg.`);
  }

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