const mongoose = require('mongoose');

/**
 * Small key/value store for site-wide settings the admin controls from the
 * dashboard (instead of hard-coding them in the HTML).
 *
 * Currently used for:
 *   key: 'studioNotice'  ->  value: { date: 'YYYY-MM-DD' }   ("studio booked until" date)
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);