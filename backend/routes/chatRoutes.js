const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/chatController');

const router = express.Router();

router.post('/', optionalAuth, ctrl.chat);

module.exports = router;