const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/orderController');

const router = express.Router();

router.use(protect);

router.post('/', ctrl.createOrder);
router.get('/', ctrl.getMyOrders);
router.get('/admin/all', adminOnly, ctrl.getAllOrders);
router.get('/:id', ctrl.getOrder);
router.put('/:id/cancel', ctrl.cancelOrder);
router.put('/:id/status', adminOnly, ctrl.updateOrderStatus);
router.put('/:id/payment-status', adminOnly, ctrl.updatePaymentStatus);

module.exports = router;