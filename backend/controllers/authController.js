// ShopSphere Authentication Controller
// Manages User Registration, Login, and Profile details with Password Hashing & JWT generation

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Generates a signed JWT for the user.
 * @param {object} user - User detail payload containing id, email, and role.
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'shopsphere_jwt_secret_key_12345_secure',
    { expiresIn: '30d' }
  );
}

/**
 * Handles User Registration.
 * Creates hashed password, checks for duplicate email, inserts user, and initializes their cart.
 */
async function register(req, res) {
  const { name, email, password } = req.body;

  // 1. Basic input validation
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
  }

  try {
    // 2. Prevent duplicate emails
    const existingUser = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // 3. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Insert new user into database
    const insertResult = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "user")',
      [name, email, hashedPassword]
    );
    const userId = insertResult.insertId;

    // 5. Initialize a shopping cart for this new user
    await db.query('INSERT INTO cart (user_id) VALUES (?)', [userId]);

    // 6. Generate token and return details
    const newUser = { id: userId, name, email, role: 'user' };
    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: newUser
    });

  } catch (error) {
    console.error('[Auth Controller] Registration error:', error.message);
    res.status(500).json({ success: false, message: 'Server error during registration. Please try again.' });
  }
}

/**
 * Handles User Login.
 * Verifies email/password and returns a JWT token.
 */
async function login(req, res) {
  const { email, password } = req.body;

  // 1. Check for empty fields
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password.' });
  }

  try {
    // 2. Retrieve user
    const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];

    // 3. Check password match
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // 4. Generate JWT
    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('[Auth Controller] Login error:', error.message);
    res.status(500).json({ success: false, message: 'Server error during login. Please try again.' });
  }
}

/**
 * Retrieves profile of the logged-in user.
 * Verified user object is already attached to req by 'protect' middleware.
 */
function getProfile(req, res) {
  if (req.user) {
    res.status(200).json({
      success: true,
      user: req.user
    });
  } else {
    res.status(404).json({ success: false, message: 'User profile not found.' });
  }
}

/**
 * Administrative endpoint to view all users.
 * Requires protect and adminOnly middleware.
 */
async function getAllUsers(req, res) {
  try {
    const users = await db.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY id ASC'
    );
    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('[Auth Controller] Fetch users error:', error.message);
    res.status(500).json({ success: false, message: 'Server error retrieving users.' });
  }
}

module.exports = {
  register,
  login,
  getProfile,
  getAllUsers
};
