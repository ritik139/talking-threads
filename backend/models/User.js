const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Home' },
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: 'India' },
    phone: String,
    isDefault: { type: Boolean, default: false }
  },
  { _id: true, timestamps: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [function passwordRequiredUnlessGoogle() { return !this.googleId; }, 'Password is required'],
      minlength: 6,
      select: false
    },
    googleId: { type: String, index: true, sparse: true, unique: true },
    avatar: { type: String, default: '' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    phone: { type: String, trim: true },
    addresses: [addressSchema],
    newsletterSubscribed: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.password || !this.isModified('password')) return next();

  // Guard against re-hashing a value that's already a bcrypt hash. Without this,
  // any script that loads a user (e.g. a migration import) and calls .save()
  // with the password field already set to a hash will hash it a second time,
  // silently breaking login for that user. $2a$ / $2b$ / $2y$ are all valid
  // bcrypt prefixes (PHP/Laravel systems commonly use $2y$).
  const isAlreadyBcryptHash = /^\$2[aby]\$\d{2}\$.{53}$/.test(this.password);
  if (isAlreadyBcryptHash) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false); // Google-only accounts have no local password
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);