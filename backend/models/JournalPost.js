const mongoose = require('mongoose');
const slugify = require('slugify');

const journalPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    author: { type: String, default: 'Talking-Thread Studio' },
    tags: [{ type: String, trim: true }],
    isPublished: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

journalPostSchema.pre('validate', function generateSlug(next) {
  if (this.title && (!this.slug || this.isModified('title'))) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('JournalPost', journalPostSchema);
