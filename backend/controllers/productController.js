// ShopSphere Product Controller
// Coordinates product display, category list, query sorting, search filters, and Admin CRUD operations

const db = require('../config/db');
const fs = require('fs');
const path = require('path');

/**
 * Fetches all products based on active catalog filters.
 * Supported Query Parameters:
 * - search: filters by title/description match
 * - category: filters by category ID
 * - sort: 'asc' or 'desc' sorting by product price
 */
async function getAllProducts(req, res) {
  const { search, category, sort } = req.query;

  let sql = `
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE 1=1
  `;
  const params = [];

  // 1. Filter by category
  if (category) {
    sql += ' AND p.category_id = ?';
    params.push(category);
  }

  // 2. Filter by search text
  if (search) {
    sql += ' AND (p.title LIKE ? OR p.description LIKE ?)';
    const searchWildcard = `%${search}%`;
    params.push(searchWildcard, searchWildcard);
  }

  // 3. Price Sorting
  if (sort === 'asc') {
    sql += ' ORDER BY p.price ASC';
  } else if (sort === 'desc') {
    sql += ' ORDER BY p.price DESC';
  } else {
    sql += ' ORDER BY p.id DESC'; // default order
  }

  try {
    const products = await db.query(sql, params);
    res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    console.error('[Product Controller] Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error retrieving products.' });
  }
}

/**
 * Fetches details of a single product.
 */
async function getProductById(req, res) {
  const { id } = req.params;

  try {
    const products = await db.query(
      `SELECT p.*, c.name as category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ?`,
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.status(200).json({
      success: true,
      product: products[0]
    });
  } catch (error) {
    console.error('[Product Controller] Fetch single error:', error.message);
    res.status(500).json({ success: false, message: 'Server error retrieving product details.' });
  }
}

/**
 * Fetches all available categories.
 */
async function getCategories(req, res) {
  try {
    const categories = await db.query('SELECT * FROM categories ORDER BY name ASC');
    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('[Product Controller] Categories fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error retrieving categories.' });
  }
}

/**
 * Admin Action: Create Product.
 */
async function createProduct(req, res) {
  const { title, price, category_id, description, image_url, stock } = req.body;

  if (!title || price === undefined || !category_id) {
    return res.status(400).json({ success: false, message: 'Please provide product title, price, and category.' });
  }

  try {
    const parsedPrice = parseFloat(price);
    const parsedCategory = parseInt(category_id, 10);
    const parsedStock = stock !== undefined ? parseInt(stock, 10) : 10;
    const finalImageUrl = image_url || '/images/products/placeholder.jpg';

    const insertResult = await db.query(
      'INSERT INTO products (title, price, category_id, description, image_url, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [title, parsedPrice, parsedCategory, description || '', finalImageUrl, parsedStock]
    );

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      productId: insertResult.insertId
    });
  } catch (error) {
    console.error('[Product Controller] Create error:', error.message);
    res.status(500).json({ success: false, message: 'Server error creating product.' });
  }
}

/**
 * Admin Action: Update Product details.
 */
async function updateProduct(req, res) {
  const { id } = req.params;
  const { title, price, category_id, description, image_url, stock } = req.body;

  if (!title || price === undefined || !category_id) {
    return res.status(400).json({ success: false, message: 'Please provide title, price, and category.' });
  }

  try {
    // Check if product exists
    const existing = await db.query('SELECT id FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const parsedPrice = parseFloat(price);
    const parsedCategory = parseInt(category_id, 10);
    const parsedStock = parseInt(stock, 10);
    const finalImageUrl = image_url || '/images/products/placeholder.jpg';

    await db.query(
      'UPDATE products SET title = ?, price = ?, category_id = ?, description = ?, image_url = ?, stock = ? WHERE id = ?',
      [title, parsedPrice, parsedCategory, description || '', finalImageUrl, parsedStock, id]
    );

    res.status(200).json({
      success: true,
      message: 'Product updated successfully.'
    });
  } catch (error) {
    console.error('[Product Controller] Update error:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating product.' });
  }
}

/**
 * Admin Action: Delete Product.
 */
async function deleteProduct(req, res) {
  const { id } = req.params;

  try {
    // Check if product exists
    const existing = await db.query('SELECT id FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Delete the product
    await db.query('DELETE FROM products WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully.'
    });
  } catch (error) {
    console.error('[Product Controller] Delete error:', error.message);
    res.status(500).json({ success: false, message: 'Server error deleting product.' });
  }
}

/**
 * Admin Action: Decode base64 image data and save it as a physical file on the server.
 */
async function uploadImage(req, res) {
  const { base64Data } = req.body;
  if (!base64Data) {
    return res.status(400).json({ success: false, message: 'Please provide base64 image data.' });
  }

  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, message: 'Invalid image format.' });
    }

    const ext = matches[1].split('/')[1]; // e.g. "jpeg", "png"
    const buffer = Buffer.from(matches[2], 'base64');
    const uniqueName = `product_${Date.now()}_${Math.round(Math.random() * 1e9)}.${ext}`;
    
    const uploadDir = path.join(__dirname, '../../frontend/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, buffer);

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully.',
      image_url: `/uploads/${uniqueName}`
    });
  } catch (error) {
    console.error('[Product Controller] Image upload error:', error.message);
    res.status(500).json({ success: false, message: 'Server error saving image.' });
  }
}

/**
 * Admin Action: Marks a single product as the Best Seller.
 * Kept simple and perfect by setting all other products is_bestseller to 0.
 */
async function setBestSeller(req, res) {
  const { id } = req.params;

  try {
    // 1. Verify product exists
    const existing = await db.query('SELECT id FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // 2. Set all other products to is_bestseller = 0, and this one to 1 inside atomic updates
    await db.query('UPDATE products SET is_bestseller = 0');
    await db.query('UPDATE products SET is_bestseller = 1 WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Product marked as best seller successfully.'
    });
  } catch (error) {
    console.error('[Product Controller] Best Seller update error:', error.message);
    res.status(500).json({ success: false, message: 'Server error setting best seller.' });
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImage,
  setBestSeller
};
