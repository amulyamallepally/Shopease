// ShopSphere Authentication Middleware
// Protects endpoints using JSON Web Token (JWT) validation and manages user roles

const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Route protection middleware to verify JWT.
 * Assumes the token is passed inside the Authorization header as: Bearer <token>
 */
async function protect(req, res, next) {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract token from header
      token = req.headers.authorization.split(' ')[1];

      // Decode and verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shopsphere_jwt_secret_key_12345_secure');

      // Fetch user from database to ensure user still exists and role is accurate
      const users = await db.query(
        'SELECT id, name, email, role FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(401).json({ success: false, message: 'User belonging to this token no longer exists.' });
      }

      // Attach user details to the request object
      req.user = users[0];
      next();
    } catch (error) {
      console.error('[Auth Middleware] Token validation failed:', error.message);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed.' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided.' });
  }
}

/**
 * Role authorization middleware restricting access to Admin users only.
 * Must be used AFTER protect middleware.
 */
function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Administrator privileges are required.'
    });
  }
}

module.exports = {
  protect,
  adminOnly
};
