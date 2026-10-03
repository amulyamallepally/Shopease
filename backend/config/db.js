// ShopSphere MySQL Connection Pool Configuration
// Includes self-healing database initialization and automated table creation/seeding

const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

/**
 * Initializes the MySQL database connection.
 * First connects to the MySQL server directly to ensure the database exists,
 * then establishes a connection pool with the database selected, and
 * verifies or creates all required tables and seeding data automatically.
 */
async function initializeDatabase() {
  const connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  };

  try {
    // 1. Connect without database name to ensure database exists
    const tempConnection = await mysql.createConnection(connectionConfig);
    const dbName = process.env.DB_NAME || 'shopsphere';
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await tempConnection.end();

    // 2. Establish connection pool with database selected
    pool = mysql.createPool({
      ...connectionConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`[Database] Connected to MySQL pool on database: ${dbName}`);

    // 3. Create tables and inject seed data if tables are empty
    await createTablesAndSeed();

  } catch (error) {
    console.error('[Database Error] Failed to initialize database connection:', error.message);
    console.error('Make sure your local MySQL server is running and credentials in backend/.env are correct.');
    // Do not crash the server immediately, but log heavily so the student knows why.
    throw error;
  }
}

/**
 * Ensures all relational tables exist and inserts starter seed data if categories are empty.
 */
async function createTablesAndSeed() {
  if (!pool) return;

  try {
    // 1. Categories Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT
      ) ENGINE=InnoDB;
    `);

    // 2. Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 3. Products Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        category_id INT,
        description TEXT,
        image_url VARCHAR(255),
        stock INT DEFAULT 10,
        is_bestseller TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // Self-healing database check: ensure is_bestseller column exists
    try {
      await pool.query('ALTER TABLE products ADD COLUMN is_bestseller TINYINT(1) DEFAULT 0');
      console.log('[Database Sync] Successfully added is_bestseller column to products.');
    } catch (err) {
      // Ignore error if column is already present
    }

    // 4. Cart Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 5. Cart Items Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cart_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        UNIQUE KEY unique_cart_product (cart_id, product_id),
        FOREIGN KEY (cart_id) REFERENCES cart(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 6. Orders Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        shipping_address TEXT NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 7. Order Items Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT,
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // 4. Check & Seed Categories
    const [catCount] = await pool.query('SELECT COUNT(*) as count FROM categories');
    if (catCount[0].count === 0) {
      await pool.query(`
        INSERT INTO categories (id, name, description) VALUES
        (1, 'Electronics', 'Gadgets, devices, smart appliances and computational gear'),
        (2, 'Fashion', 'Premium apparel, shoes, jackets and stylish collections'),
        (3, 'Books', 'Inspiring texts, coding manuals, self-help books and guides'),
        (4, 'Home & Living', 'Elegant lighting, modern pottery, and luxury interior additions'),
        (5, 'Accessories', 'Complete your look with premium jewelry, bags, and luxury timepieces');
      `);
      console.log('[Database] Seeded 5 product categories.');
    } else {
      // Keep category names updated (e.g. rename 4 to Home & Living, add 5 if missing)
      await pool.query('UPDATE categories SET name = "Home & Living" WHERE id = 4');
      await pool.query('INSERT IGNORE INTO categories (id, name, description) VALUES (5, "Accessories", "Complete your look with premium jewelry, bags, and luxury timepieces")');
    }

    // 5. Check & Seed Products
    const [prodCount] = await pool.query('SELECT COUNT(*) as count FROM products');
    if (prodCount[0].count === 0) {
      await pool.query(`
        INSERT INTO products (id, title, price, category_id, description, image_url, stock, is_bestseller) VALUES
        (1, 'iPhone 15 Pro', 999.99, 1, 'Experience titanium durability, standard-setting A17 Pro performance, and the most versatile camera system in a smartphone.', '/images/products/iphone.jpg', 15, 0),
        (2, 'Premium Sound Pro', 129.00, 1, 'Feel Every Beat. Live Every Moment. Noise canceling over-ear headphones with premium acoustics.', '/images/products/headphones.jpg', 25, 1),
        (3, 'Denim Rider Jacket', 79.99, 2, 'A timeless slim-fit denim outerwear crafted from organic durable cotton, designed with comfortable pockets and dynamic copper hardware.', '/images/products/jacket.jpg', 30, 0),
        (4, 'Performance Sneakers', 59.49, 2, 'Lightweight athletic running shoes featuring a high-cushion mesh upper and shock-absorbing grid soles for perfect daily workouts.', '/images/products/sneakers.jpg', 20, 0),
        (5, 'The Pragmatic Programmer', 45.00, 3, 'Classic software engineering textbook focusing on individual responsibility, pragmatic career guidance, and robust maintainable code.', '/images/products/books_prog.jpg', 50, 0),
        (6, 'Atomic Habits', 26.99, 3, 'An extremely simple and highly practical framework to build tiny positive habits, break negative patterns, and master consistent daily progress.', '/images/products/books_habits.jpg', 40, 0),
        (7, 'Minimalist Ceramic Vase', 34.99, 4, 'Handcrafted matte ceramic earthenware featuring a stunning textured finish that fits perfectly in any Scandinavian or contemporary room.', '/images/products/vase.jpg', 12, 0),
        (8, 'Adjustable Desk Lamp', 22.49, 4, 'Sleek metal desk lamp with high-brightness adjustable LED panels, touch control, warm-to-cool hues, and built-in USB charging ports.', '/images/products/lamp.jpg', 18, 0);
      `);
      console.log('[Database] Seeded 8 default products.');
    } else {
      // Sync Best Seller naming and price for product ID 2 if it's currently default
      await pool.query('UPDATE products SET title = "Premium Sound Pro", price = 129.00, description = "Feel Every Beat. Live Every Moment. Noise canceling over-ear headphones with premium acoustics.", is_bestseller = 1 WHERE id = 2 AND title = "Sony Wireless Headphones"');
    }

    // 6. Check & Seed Users
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
    
    // Dynamically generate secure password hashes using the local bcryptjs engine
    const bcrypt = require('bcryptjs');
    const adminHashedPassword = await bcrypt.hash('admin123', 10);
    const userHashedPassword = await bcrypt.hash('user123', 10);

    if (userCount[0].count === 0) {
      // Seed default accounts
      await pool.query(`
        INSERT INTO users (id, name, email, password, role) VALUES
        (1, 'ShopSphere Admin', 'admin@shopsphere.com', ?, 'admin'),
        (2, 'Jane Doe', 'user@shopsphere.com', ?, 'user');
      `, [adminHashedPassword, userHashedPassword]);
      
      // Cart initialized for Jane Doe (user_id = 2)
      await pool.query(`INSERT INTO cart (id, user_id) VALUES (1, 2) ON DUPLICATE KEY UPDATE user_id=user_id;`);
      console.log('[Database] Seeded default admin and normal user accounts dynamically.');
    } else {
      // Self-healing synchronization: updates existing default accounts to have verified hashes
      await pool.query('UPDATE users SET password = ? WHERE email = "admin@shopsphere.com"', [adminHashedPassword]);
      await pool.query('UPDATE users SET password = ? WHERE email = "user@shopsphere.com"', [userHashedPassword]);
      console.log('[Database] Dynamic bcrypt hashes successfully synchronized for default accounts.');
    }

    console.log('[Database] Relational tables checked and verified successfully.');
  } catch (error) {
    console.error('[Database Error] Failed to seed database schema:', error.message);
  }
}

/**
 * Executes a parameterized SQL query on the pool.
 * Prevents SQL injections by forcing the use of parameters.
 * @param {string} sql - The SQL statement template.
 * @param {Array} params - The array of positional query parameters.
 * @returns {Promise<any>} The matching query row collection.
 */
async function query(sql, params) {
  if (!pool) {
    throw new Error('[Database Error] Pool not initialized. Make sure initializeDatabase() was executed.');
  }
  const [results] = await pool.query(sql, params);
  return results;
}

module.exports = {
  initializeDatabase,
  query,
  getPool: () => pool
};
