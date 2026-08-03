const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/orderController');

const router = express.Router();

// Admin Dashboard (Orders) routes — require a signed-in admin, same as the other
// admin-only endpoints (productRoutes.js, journalRoutes.js, etc.).
router.get('/admin/all', protect, adminOnly, ctrl.getAllOrders);
router.put(
  '/:id/status',
  protect,
  adminOnly,
  [body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid order status')],
  validate,
  ctrl.updateOrderStatus
);
router.put(
  '/:id/payment-status',
  protect,
  adminOnly,
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
    // 'card' / 'upi' / 'paypal' are legacy values kept only so pre-existing orders still
    // validate (see models/Order.js) — this endpoint creates Cash-on-Delivery orders only;
    // real online payment must go through paymentController's verified Razorpay flow.
    body('paymentMethod').optional().isIn(['cod']).withMessage('Invalid payment method'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Order notes must be 500 characters or fewer')
  ],
  validate,
  ctrl.createOrder
);
router.get('/', protect, ctrl.getMyOrders);
router.get('/:id', protect, ctrl.getOrder);
router.put('/:id/cancel', protect, ctrl.cancelOrder);

module.exports = router;