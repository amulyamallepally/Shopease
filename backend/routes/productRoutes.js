// ShopSphere Product Catalog Routes
// Defines endpoints for public browsing and administrative catalog updates

const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductById,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImage,
  setBestSeller
} = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public catalog routes
router.get('/', getAllProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);

// Protected administrative CRUD routes
router.post('/', protect, adminOnly, createProduct);
router.post('/upload', protect, adminOnly, uploadImage);
router.put('/bestseller/:id', protect, adminOnly, setBestSeller);
router.put('/:id', protect, adminOnly, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);

module.exports = router;
