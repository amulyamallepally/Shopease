// ShopSphere Shopping Cart Client Script
// Manages display of cart items, quantity adjustments, deletion triggers, and summaries

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('cart-items-panel')) {
    loadCart();
  }
});

/**
 * Queries cart items from backend and displays them in a clean table layout.
 */
async function loadCart() {
  const panel = document.getElementById('cart-items-panel');
  const summaryPanel = document.getElementById('cart-summary-panel');
  const tableBody = document.getElementById('cart-table-body');
  
  if (!panel || !tableBody) return;

  try {
    const res = await fetchWithAuth('/api/cart');
    
    if (res.success) {
      const items = res.cartItems;

      if (items.length === 0) {
        // Show empty cart dashboard layout
        panel.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🛒</div>
            <h3>Your cart is empty</h3>
            <p>Looks like you haven't added anything to your cart yet. Head to products catalog!</p>
            <a href="/products.html" class="btn btn-primary">Browse Products</a>
          </div>
        `;
        if (summaryPanel) summaryPanel.style.display = 'none';
        
        // Hide standard columns headers
        const table = document.getElementById('cart-table');
        if (table) table.style.display = 'none';
      } else {
        // Render items inside table
        let rowsHtml = '';
        let subtotal = 0;

        items.forEach(item => {
          const itemSubtotal = parseFloat(item.price) * item.quantity;
          subtotal += itemSubtotal;

          rowsHtml += `
            <tr class="cart-row">
              <td>
                <div class="cart-item-detail">
                  <div class="cart-item-img">
                    ${getCartItemEmoji(item.title)}
                  </div>
                  <div>
                    <h4 class="cart-item-title">${item.title}</h4>
                    <span class="cart-item-meta">In Stock: ${item.stock}</span>
                  </div>
                </div>
              </td>
              <td class="cart-col-price">${formatPrice(item.price)}</td>
              <td>
                <div class="qty-controls" style="width: 120px;">
                  <button onclick="adjustQuantity(${item.product_id}, ${item.quantity - 1})" class="qty-btn">-</button>
                  <span class="qty-input">${item.quantity}</span>
                  <button onclick="adjustQuantity(${item.product_id}, ${item.quantity + 1})" class="qty-btn">+</button>
                </div>
              </td>
              <td class="cart-col-price" style="color: var(--primary);">${formatPrice(itemSubtotal)}</td>
              <td>
                <button onclick="deleteCartItem(${item.product_id})" class="btn btn-danger btn-sm" style="padding:0.4rem 0.6rem;" title="Delete Item">
                  🗑️
                </button>
              </td>
            </tr>
          `;
        });

        tableBody.innerHTML = rowsHtml;
        
        // Calculate summaries
        const shipping = subtotal > 150 ? 0 : 9.99;
        const tax = subtotal * 0.05; // 5% DBMS tax
        const total = subtotal + shipping + tax;

        document.getElementById('summary-subtotal').textContent = formatPrice(subtotal);
        document.getElementById('summary-shipping').textContent = shipping === 0 ? 'FREE' : formatPrice(shipping);
        document.getElementById('summary-tax').textContent = formatPrice(tax);
        document.getElementById('summary-total').textContent = formatPrice(total);

        if (summaryPanel) summaryPanel.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Failed to load cart:', err);
    panel.innerHTML = `<div class="alert alert-error">Error loading shopping cart.</div>`;
  }
}

/**
 * Triggers API call to modify items quantities (adds/decrements/deletes).
 */
async function adjustQuantity(productId, newQty) {
  try {
    const res = await fetchWithAuth('/api/cart/update', {
      method: 'PUT',
      body: JSON.stringify({ product_id: productId, quantity: newQty })
    });

    if (res.success) {
      if (newQty <= 0) {
        showNotification('Item removed from cart.', 'success');
      } else {
        showNotification('Cart updated.', 'success');
      }
      loadCart();
      updateCartBadgeCount();
    } else {
      showNotification(res.message || 'Failed to update quantity.', 'error');
    }
  } catch (err) {
    console.error('Quantity adjust error:', err);
  }
}

/**
 * Single item trash action.
 */
async function deleteCartItem(productId) {
  if (!confirm('Are you sure you want to remove this item?')) return;

  try {
    const res = await fetchWithAuth(`/api/cart/remove/${productId}`, {
      method: 'DELETE'
    });

    if (res.success) {
      showNotification('Item removed from cart.', 'success');
      loadCart();
      updateCartBadgeCount();
    } else {
      showNotification(res.message || 'Failed to delete item.', 'error');
    }
  } catch (err) {
    console.error('Remove cart item error:', err);
  }
}

/**
 * Full cart clearing action.
 */
async function clearAllCart() {
  if (!confirm('Clear all items from your shopping cart?')) return;

  try {
    const res = await fetchWithAuth('/api/cart/clear', {
      method: 'DELETE'
    });

    if (res.success) {
      showNotification('Cart cleared successfully.', 'success');
      loadCart();
      updateCartBadgeCount();
    } else {
      showNotification(res.message || 'Failed to clear cart.', 'error');
    }
  } catch (err) {
    console.error('Clear cart error:', err);
  }
}

/**
 * Returns simple item emojis based on names.
 */
function getCartItemEmoji(title) {
  const t = title.toLowerCase();
  if (t.includes('iphone')) return '📱';
  if (t.includes('headphones')) return '🎧';
  if (t.includes('jacket')) return '🧥';
  if (t.includes('sneakers')) return '👟';
  if (t.includes('programmer')) return '💻';
  if (t.includes('habits')) return '📖';
  if (t.includes('vase')) return '🏺';
  if (t.includes('lamp')) return '💡';
  return '📦';
}
