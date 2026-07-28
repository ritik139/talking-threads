const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/newsletterController');

const router = express.Router();

router.post('/', [body('email').isEmail().withMessage('A valid email is required')], validate, ctrl.subscribe);
router.post('/unsubscribe', [body('email').isEmail()], validate, ctrl.unsubscribe);
router.get('/', protect, adminOnly, ctrl.getSubscribers);

module.exports = router;
