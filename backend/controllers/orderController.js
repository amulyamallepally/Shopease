// ShopSphere Order Controller
// Manages checkouts using ACID SQL Transactions, order retrieval, and admin status updates

const db = require('../config/db');

/**
 * Places a new order using an atomic SQL Transaction.
 * Steps:
 * 1. Checks cart contents.
 * 2. Checks inventory levels.
 * 3. Creates the Order master record.
 * 4. Inserts items into Order details.
 * 5. Updates Product stock.
 * 6. Clears customer Cart items.
 * If any step fails, the transaction is rolled back.
 */
async function createOrder(req, res) {
  const userId = req.user.id;
  const { shipping_address, phone_number } = req.body;

  if (!shipping_address || !phone_number) {
    return res.status(400).json({ success: false, message: 'Please provide shipping address and phone number.' });
  }

  // Retrieve connection from pool to handle transactions
  const connection = await db.getPool().getConnection();

  try {
    // 1. Begin SQL Transaction
    await connection.beginTransaction();

    // 2. Fetch User's Cart
    const [carts] = await connection.query('SELECT id FROM cart WHERE user_id = ?', [userId]);
    if (carts.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Cart not initialized. Add items first.' });
    }
    const cartId = carts[0].id;

    // 3. Fetch Cart Items with current Product details
    const [cartItems] = await connection.query(
      `SELECT ci.product_id, ci.quantity, p.title, p.price, p.stock 
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    if (cartItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Your shopping cart is empty.' });
    }

    // 4. Verify stock availability and calculate total price
    let totalAmount = 0;
    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.title}. Only ${item.stock} left, but you requested ${item.quantity}.`
        });
      }
      totalAmount += parseFloat(item.price) * item.quantity;
    }

    // 5. Create Order entry
    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, total_amount, shipping_address, phone_number, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, totalAmount, shipping_address, phone_number]
    );
    const orderId = orderResult.insertId;

    // 6. Copy Cart items to Order items & update Product stock levels
    for (const item of cartItems) {
      // Create order detail
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.price]
      );

      // Decrement stock in catalog
      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // 7. Clear the Cart items
    await connection.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

    // 8. Commit the transaction
    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      orderId,
      totalAmount
    });

  } catch (error) {
    // Rollback changes on any query failure
    await connection.rollback();
    console.error('[Order Transaction Error]:', error.message);
    res.status(500).json({ success: false, message: 'Server transaction failed during checkout. Please try again.' });
  } finally {
    // Release connection back to pool
    connection.release();
  }
}

/**
 * Retrieves the order history for the logged-in customer.
 */
async function getUserOrders(req, res) {
  const userId = req.user.id;

  try {
    const orders = await db.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC',
      [userId]
    );
    res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('[Order Controller] Fetch user orders error:', error.message);
    res.status(500).json({ success: false, message: 'Server error retrieving order history.' });
  }
}

/**
 * Retrieves the full master-detail structure of a specific order.
 * Customer can only see their own orders. Admins can see all.
 */
async function getOrderById(req, res) {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    // Fetch master order details
    const orders = await db.query(
      `SELECT o.*, u.name as user_name, u.email as user_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orders[0];

    // Auth check: Is this their own order, or are they admin?
    if (order.user_id !== userId && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied to view this order.' });
    }

    // Fetch order line items (details)
    const items = await db.query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.price, 
              p.title, p.image_url
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );

    res.status(200).json({
      success: true,
      order,
      items
    });

  } catch (error) {
    console.error('[Order Controller] Fetch order detail error:', error.message);
    res.status(500).json({ success: false, message: 'Server error retrieving order details.' });
  }
}

/**
 * Admin Action: View all orders in the system.
 */
async function getAllOrders(req, res) {
  try {
    const orders = await db.query(
      `SELECT o.*, u.name as user_name, u.email as user_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.id DESC`
    );
    res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('[Order Controller] Fetch all orders error:', error.message);
    res.status(500).json({ success: false, message: 'Server error retrieving system orders.' });
  }
}

/**
 * Admin Action: Modify the shipment/delivery status of an order.
 */
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid status: ' + validStatuses.join(', ') });
  }

  try {
    const existing = await db.query('SELECT id FROM orders WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    await db.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, id]
    );

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}.`
    });

  } catch (error) {
    console.error('[Order Controller] Update status error:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating order status.' });
  }
}

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus
};
