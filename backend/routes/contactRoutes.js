const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/contactController');

const router = express.Router();

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('message').trim().notEmpty().withMessage('Message is required')
  ],
  validate,
  ctrl.submitContact
);

router.get('/', protect, adminOnly, ctrl.getMessages);
router.put(
  '/:id',
  protect,
  adminOnly,
  [body('status').isIn(['new', 'read', 'replied']).withMessage('Invalid status')],
  validate,
  ctrl.updateMessageStatus
);

module.exports = router;