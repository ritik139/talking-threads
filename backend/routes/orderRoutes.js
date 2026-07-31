const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/orderController');

const router = express.Router();

// NOTE: Admin Dashboard (Orders) routes below are intentionally left WITHOUT
// `protect`/`adminOnly` — the admin dashboard no longer requires sign-in.
// `protect` is now applied per-route (instead of router.use(protect)) so that
// normal user routes (create/list/view/cancel my own orders) still require
// login exactly as before, while the admin-only routes are open.
router.get('/admin/all', ctrl.getAllOrders);
router.put(
  '/:id/status',
  [body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid order status')],
  validate,
  ctrl.updateOrderStatus
);
router.put(
  '/:id/payment-status',
  [body('paymentStatus').isIn(['pending', 'paid', 'failed', 'refunded']).withMessage('Invalid payment status')],
  validate,
  ctrl.updatePaymentStatus
);

router.post(
  '/',
  protect,
  [
    body('shippingAddress.fullName').trim().notEmpty().withMessage('Full name is required'),
    body('shippingAddress.phone').trim().notEmpty().withMessage('Phone number is required'),
    body('shippingAddress.line1').trim().notEmpty().withMessage('Address line 1 is required'),
    body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
    body('shippingAddress.state').trim().notEmpty().withMessage('State is required'),
    body('shippingAddress.postalCode').trim().notEmpty().withMessage('Postal code is required'),
    body('shippingAddress.country').trim().notEmpty().withMessage('Country is required'),
    body('paymentMethod').optional().isIn(['cod', 'card', 'upi', 'paypal']).withMessage('Invalid payment method'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Order notes must be 500 characters or fewer')
  ],
  validate,
  ctrl.createOrder
);
router.get('/', protect, ctrl.getMyOrders);
router.get('/:id', protect, ctrl.getOrder);
router.put('/:id/cancel', protect, ctrl.cancelOrder);

module.exports = router;