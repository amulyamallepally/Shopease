// ShopSphere Authentication Routes
// Defines REST endpoints for user signup, signin, and profile details retrieve

const express = require('express');
const router = express.Router();
const { register, login, getProfile, getAllUsers } = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', protect, getProfile);
router.get('/users', protect, adminOnly, getAllUsers);

module.exports = router;
