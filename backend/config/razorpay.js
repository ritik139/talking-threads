// Single shared Razorpay SDK instance, configured from backend/.env.
// Get real keys (test mode first) from https://dashboard.razorpay.com/app/keys.
const Razorpay = require('razorpay');

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn(
    'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set in backend/.env — ' +
    'the "Pay Online" checkout option will fail until real Razorpay keys are added.'
  );
}

const razorpay = new Razorpay({
  key_id: keyId || 'rzp_test_missing_key',
  key_secret: keySecret || 'missing_secret'
});

module.exports = razorpay;