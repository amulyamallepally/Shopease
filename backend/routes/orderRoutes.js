// ShopSphere Order Routes
// Manages customer checkouts and admin-only order tracking tools

const express = require('express');
const router = express.Router();
const {
  createOrder,
  getUserOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus
} = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// All checkout and ordering operations require an active login session
router.use(protect);

// Customer ordering routes
router.post('/', createOrder);
router.get('/history', getUserOrders);
router.get('/detail/:id', getOrderById);

// Admin-only transactional oversight routes
router.get('/admin/all', adminOnly, getAllOrders);
router.put('/admin/status/:id', adminOnly, updateOrderStatus);

module.exports = router;
