const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const router = express.Router();

router.post(
  '/register',
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ min: 2, max: 80 }).withMessage('Full name must be between 2 and 80 characters'),
    body('email')
      .trim()
      .isEmail().withMessage('Please enter a valid email address')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6, max: 72 }).withMessage('Password must be between 6 and 72 characters')
  ],
  validate,
  ctrl.register
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validate,
  ctrl.login
);

router.post('/logout', ctrl.logout);

// "Continue with Google" — full-page redirects, not JSON APIs
router.get('/google', ctrl.googleAuthStart);
router.get('/google/callback', ctrl.googleAuthCallback);

router.get('/me', protect, ctrl.getMe);
router.put('/me', protect, ctrl.updateMe);
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6, max: 72 }).withMessage('New password must be between 6 and 72 characters')
  ],
  validate,
  ctrl.changePassword
);
router.post('/addresses', protect, ctrl.addAddress);
router.delete('/addresses/:addressId', protect, ctrl.deleteAddress);

module.exports = router;