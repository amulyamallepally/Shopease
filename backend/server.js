// ShopSphere Application Main Server
// Orchestrates environment loading, MySQL connection initialization, static file serving, and modular routing

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./config/db');

// Import modular API routers
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Wires general middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 2. Serves static frontend files (HTML, CSS, JS, images)
// This serves all HTML pages (index.html, login.html, etc.) directly on the root URI
app.use(express.static(path.join(__dirname, '../frontend')));

// 3. Connects modular REST API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// 4. Fallback route: If an API endpoint is not found
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'REST API endpoint not found.' });
});

// 5. Catch-all fallback for frontend routes (Serves index.html for smooth client browsing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 6. Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Global Server Error]:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.'
  });
});

// 7. Launches database pool and starts the server
async function startServer() {
  try {
    // Attempt database initialization
    await db.initializeDatabase();

    // Start listening
    app.listen(PORT, () => {
      console.log(`=============================================================`);
      console.log(`   ShopSphere Stack Server is running!`);
      console.log(`   Local Server Access URL: http://localhost:${PORT}`);
      console.log(`=============================================================`);
    });
  } catch (error) {
    console.error('Failed to start server due to database connectivity issues.');
    console.log('Server is attempting to boot in safe-mode with limited DB connection...');

    // Boot anyway so frontend files are still hosted even if DB is offline,
    // which helps the student verify HTML layouts and review connection warnings!
    app.listen(PORT, () => {
      console.log(`[Safe-Mode Boot] Frontend served at: http://localhost:${PORT}`);
      console.log(`⚠️  Warning: MySQL connection failed. APIs will return error states.`);
    });
  }
}

startServer();
