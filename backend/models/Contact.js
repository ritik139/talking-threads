const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: {
      type: String,
      enum: ['General Enquiry', 'Custom Embroidery Order', 'Order Support', 'Wholesale & Press'],
      default: 'General Enquiry'
    },
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'read', 'replied'], default: 'new' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contact', contactSchema);
