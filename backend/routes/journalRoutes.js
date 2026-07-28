const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/journalController');

const router = express.Router();

router.get('/', ctrl.getPosts);
router.get('/:slug', ctrl.getPost);

router.post('/', protect, adminOnly, ctrl.createPost);
router.put('/:id', protect, adminOnly, ctrl.updatePost);
router.delete('/:id', protect, adminOnly, ctrl.deletePost);

module.exports = router;
