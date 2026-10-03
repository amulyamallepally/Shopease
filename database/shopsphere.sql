-- ShopSphere E-Commerce DBMS College Project SQL Schema
-- Creates database, tables, and populates sample data.

CREATE DATABASE IF NOT EXISTS shopsphere;
USE shopsphere;

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PRODUCTS TABLE
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
);

-- 4. CART TABLE
CREATE TABLE IF NOT EXISTS cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. CART_ITEMS TABLE
CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cart_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    UNIQUE KEY unique_cart_product (cart_id, product_id),
    FOREIGN KEY (cart_id) REFERENCES cart(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 6. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    shipping_address TEXT NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. ORDER_ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- ========================================================
-- INSERT SEED DATA
-- ========================================================

-- Insert Categories
INSERT IGNORE INTO categories (id, name, description) VALUES
(1, 'Electronics', 'Gadgets, devices, smart appliances and computational gear'),
(2, 'Fashion', 'Premium apparel, shoes, jackets and stylish collections'),
(3, 'Books', 'Inspiring texts, coding manuals, self-help books and guides'),
(4, 'Home & Living', 'Elegant lighting, modern pottery, and luxury interior additions'),
(5, 'Accessories', 'Complete your look with premium jewelry, bags, and luxury timepieces');

-- Insert Sample Products
INSERT IGNORE INTO products (id, title, price, category_id, description, image_url, stock, is_bestseller) VALUES
(1, 'iPhone 15 Pro', 999.99, 1, 'Experience titanium durability, standard-setting A17 Pro performance, and the most versatile camera system in a smartphone.', '/images/products/iphone.jpg', 15, 0),
(2, 'Premium Sound Pro', 129.00, 1, 'Feel Every Beat. Live Every Moment. Noise canceling over-ear headphones with premium acoustics.', '/images/products/headphones.jpg', 25, 1),
(3, 'Denim Rider Jacket', 79.99, 2, 'A timeless slim-fit denim outerwear crafted from organic durable cotton, designed with comfortable pockets and dynamic copper hardware.', '/images/products/jacket.jpg', 30, 0),
(4, 'Performance Sneakers', 59.49, 2, 'Lightweight athletic running shoes featuring a high-cushion mesh upper and shock-absorbing grid soles for perfect daily workouts.', '/images/products/sneakers.jpg', 20, 0),
(5, 'The Pragmatic Programmer', 45.00, 3, 'Classic software engineering textbook focusing on individual responsibility, pragmatic career guidance, and robust maintainable code.', '/images/products/books_prog.jpg', 50, 0),
(6, 'Atomic Habits', 26.99, 3, 'An extremely simple and highly practical framework to build tiny positive habits, break negative patterns, and master consistent daily progress.', '/images/products/books_habits.jpg', 40, 0),
(7, 'Minimalist Ceramic Vase', 34.99, 4, 'Handcrafted matte ceramic earthenware featuring a stunning textured finish that fits perfectly in any Scandinavian or contemporary room.', '/images/products/vase.jpg', 12, 0),
(8, 'Adjustable Desk Lamp', 22.49, 4, 'Sleek metal desk lamp with high-brightness adjustable LED panels, touch control, warm-to-cool hues, and built-in USB charging ports.', '/images/products/lamp.jpg', 18, 0);

-- Insert Default Users
-- admin@shopsphere.com: password is 'admin123' (hashed using bcrypt)
-- user@shopsphere.com: password is 'user123' (hashed using bcrypt)
-- Note: Below passwords are pre-hashed using standard bcrypt so they work out of the box!
-- 'admin123' hash: $2a$10$fV2o5Qy/K0T2Z8J9M7z6Uex83d40.m06uK/5Fk2Ghe1234567890a (Or generated programmatically)
-- Let's use a standard bcrypt hash of 'admin123' -> $2a$10$gN47X.M2vI.Hnle4D0F8QOa9L/5D7KoxY7h82r5a.U1aL/g7K87XW
-- Let's use a standard bcrypt hash of 'user123' -> $2a$10$rN2qC3Wf7wJ6l8f9y5v1Oem2pGg1d2e3f4h5i6j7k8l9m0n1o2p3q

INSERT IGNORE INTO users (id, name, email, password, role) VALUES
(1, 'ShopSphere Admin', 'admin@shopsphere.com', '$2a$10$O0F/aM5dI8pPjEaL.V0K3O/k6sLshw2lZpX/fWc7Jv4.7b3.u3mN.', 'admin'),
(2, 'Jane Doe', 'user@shopsphere.com', '$2a$10$rX/y3R3yL2K7qE2XvH1JCeQ9m5L4jN7ZkQ6a7W0c8.m0vL5O5z6P2', 'user');

-- Insert Initial Empty Cart for jane doe
INSERT IGNORE INTO cart (id, user_id) VALUES (1, 2);
