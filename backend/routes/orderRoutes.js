const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/orderController');

const router = express.Router();

router.use(protect);

router.post(
  '/',
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
router.get('/', ctrl.getMyOrders);
router.get('/admin/all', adminOnly, ctrl.getAllOrders);
router.get('/:id', ctrl.getOrder);
router.put('/:id/cancel', ctrl.cancelOrder);
router.put(
  '/:id/status',
  adminOnly,
  [body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid order status')],
  validate,
  ctrl.updateOrderStatus
);
router.put(
  '/:id/payment-status',
  adminOnly,
  [body('paymentStatus').isIn(['pending', 'paid', 'refunded']).withMessage('Invalid payment status')],
  validate,
  ctrl.updatePaymentStatus
);

module.exports = router;