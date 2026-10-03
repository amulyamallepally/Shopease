// ShopSphere Shopping Cart Controller
// Handles adding items, managing quantities, and clearing the relational cart database

const db = require('../config/db');

/**
 * Helper to retrieve or automatically initialize a user's cart ID.
 * @param {number} userId - The user's ID from req.user.
 * @returns {Promise<number>} The user's cart ID.
 */
async function getOrCreateCartId(userId) {
  let cartResult = await db.query('SELECT id FROM cart WHERE user_id = ?', [userId]);
  
  if (cartResult.length === 0) {
    const insertResult = await db.query('INSERT INTO cart (user_id) VALUES (?)', [userId]);
    return insertResult.insertId;
  }
  
  return cartResult[0].id;
}

/**
 * Fetches all items in the current user's shopping cart, joining product details.
 */
async function getCart(req, res) {
  const userId = req.user.id;

  try {
    const cartId = await getOrCreateCartId(userId);

    const cartItems = await db.query(
      `SELECT ci.id as item_id, ci.product_id, ci.quantity, 
              p.title, p.price, p.image_url, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    res.status(200).json({
      success: true,
      cartItems
    });
  } catch (error) {
    console.error('[Cart Controller] Fetch cart error:', error.message);
    res.status(500).json({ success: false, message: 'Server error retrieving your cart.' });
  }
}

/**
 * Adds an item to the shopping cart or increments quantity if it exists.
 */
async function addToCart(req, res) {
  const userId = req.user.id;
  const { product_id, quantity = 1 } = req.body;

  if (!product_id) {
    return res.status(400).json({ success: false, message: 'Please specify product_id.' });
  }

  try {
    const cartId = await getOrCreateCartId(userId);
    const parsedQty = parseInt(quantity, 10);

    // 1. Verify product exists and has sufficient stock
    const products = await db.query('SELECT id, title, stock FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const product = products[0];

    // 2. Check if product already exists in user's cart
    const existingItems = await db.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, product_id]
    );

    if (existingItems.length > 0) {
      const newQuantity = existingItems[0].quantity + parsedQty;

      // Check stock limit
      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Only ${product.stock} units are available in stock.`
        });
      }

      await db.query(
        'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
        [newQuantity, cartId, product_id]
      );
    } else {
      // Check stock limit
      if (parsedQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add. Only ${product.stock} units are available in stock.`
        });
      }

      await db.query(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
        [cartId, product_id, parsedQty]
      );
    }

    res.status(200).json({
      success: true,
      message: `${product.title} added to cart.`
    });

  } catch (error) {
    console.error('[Cart Controller] Add error:', error.message);
    res.status(500).json({ success: false, message: 'Server error adding product to cart.' });
  }
}

/**
 * Updates the quantity of a specific product in the cart.
 * If quantity is 0 or less, deletes the cart item.
 */
async function updateCartItem(req, res) {
  const userId = req.user.id;
  const { product_id, quantity } = req.body;

  if (!product_id || quantity === undefined) {
    return res.status(400).json({ success: false, message: 'Please provide product_id and quantity.' });
  }

  try {
    const cartId = await getOrCreateCartId(userId);
    const parsedQty = parseInt(quantity, 10);

    if (parsedQty <= 0) {
      // Remove item entirely
      await db.query(
        'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cartId, product_id]
      );
      return res.status(200).json({ success: true, message: 'Item removed from cart.' });
    }

    // Verify product stock limit
    const products = await db.query('SELECT stock, title FROM products WHERE id = ?', [product_id]);
    if (products.length > 0 && parsedQty > products[0].stock) {
      return res.status(400).json({
        success: false,
        message: `Cannot update quantity. Only ${products[0].stock} units of ${products[0].title} available.`
      });
    }

    await db.query(
      'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
      [parsedQty, cartId, product_id]
    );

    res.status(200).json({
      success: true,
      message: 'Cart item quantity updated.'
    });

  } catch (error) {
    console.error('[Cart Controller] Update cart error:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating cart quantity.' });
  }
}

/**
 * Removes a specific product from the cart.
 */
async function removeFromCart(req, res) {
  const userId = req.user.id;
  const { productId } = req.params;

  try {
    const cartId = await getOrCreateCartId(userId);

    await db.query(
      'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, productId]
    );

    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully.'
    });
  } catch (error) {
    console.error('[Cart Controller] Remove item error:', error.message);
    res.status(500).json({ success: false, message: 'Server error removing item from cart.' });
  }
}

/**
 * Empties the cart entirely.
 */
async function clearCart(req, res) {
  const userId = req.user.id;

  try {
    const cartId = await getOrCreateCartId(userId);

    await db.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

    res.status(200).json({
      success: true,
      message: 'Shopping cart cleared.'
    });
  } catch (error) {
    console.error('[Cart Controller] Clear cart error:', error.message);
    res.status(500).json({ success: false, message: 'Server error clearing cart.' });
  }
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};
