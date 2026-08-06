/*
 * One-off fix: resets the password of the admin account identified by ADMIN_EMAIL
 * (in .env) to the current ADMIN_PASSWORD value. Use this when seed.js reported
 * "Admin account already exists" but you can't sign in with the credentials
 * currently in .env — it means the account was created earlier with a different
 * password (e.g. the ChangeMe123! fallback, or it started life as a normal
 * customer registration) and seed.js never updates an existing user's password.
 *
 * This does NOT touch products, orders, or any other user —
 * it only updates the password field on the one admin account.
 *
 * Usage (from backend/):
 *   node seed/reset-admin-password.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function run() {
  await connectDB();

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@talking-thread.com').toLowerCase();
  const newPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  const user = await User.findOne({ email: adminEmail });

  if (!user) {
    console.log(`No account found for ${adminEmail}. Run "npm run seed" first to create it.`);
    await mongoose.disconnect();
    return;
  }

  // Setting .password and calling .save() runs the model's pre('save') hash hook,
  // so this ends up bcrypt-hashed exactly like a normal signup/change-password would.
  user.password = newPassword;
  user.role = 'admin'; // in case this email was previously a normal customer account
  await user.save();

  console.log(`Password reset for ${adminEmail}. You can now sign in at /admin-login.html with the ADMIN_PASSWORD currently in .env.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed to reset admin password:', err);
  process.exit(1);
});