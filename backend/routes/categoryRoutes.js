const express = require('express');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/categoryController');

const router = express.Router();

// optionalAuth so ?all=true can reveal hidden categories to an admin without
// blocking the ordinary shopper request that powers the filter sidebar.
router.get('/', optionalAuth, ctrl.getCategories);

router.get('/admin/all', protect, adminOnly, ctrl.getCategoriesAdmin);
router.post('/', protect, adminOnly, ctrl.createCategory);
router.put('/:id', protect, adminOnly, ctrl.updateCategory);
router.delete('/:id', protect, adminOnly, ctrl.deleteCategory);

module.exports = router;