// ShopSphere User Order History Script
// Manages display of past customer order summaries and line item detail popups

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('orders-list')) {
    loadOrders();
    setupOrderDetailsModal();
  }
});

/**
 * Loads order history list for current customer.
 */
async function loadOrders() {
  const container = document.getElementById('orders-list');
  if (!container) return;

  container.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetchWithAuth('/api/orders/history');
    
    if (res.success) {
      const orders = res.orders;

      if (orders.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📦</div>
            <h3>No orders found</h3>
            <p>You haven't placed any orders yet. Visit our store to find your favorite items!</p>
            <a href="/products.html" class="btn btn-primary">Start Shopping</a>
          </div>
        `;
      } else {
        container.innerHTML = orders.map(order => {
          const dateStr = new Date(order.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          return `
            <div class="order-card">
              <div class="order-card-header">
                <div class="order-meta-info">
                  <div class="order-meta-item">
                    <span class="order-meta-label">Order Placed</span>
                    <span class="order-meta-value">${dateStr}</span>
                  </div>
                  <div class="order-meta-item">
                    <span class="order-meta-label">Total Amount</span>
                    <span class="order-meta-value price">${formatPrice(order.total_amount)}</span>
                  </div>
                  <div class="order-meta-item">
                    <span class="order-meta-label">Ship To</span>
                    <span class="order-meta-value" title="${order.shipping_address}" style="max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${order.shipping_address}
                    </span>
                  </div>
                </div>
                <div>
                  <span class="badge badge-${order.status}">${order.status.toUpperCase()}</span>
                </div>
              </div>
              <div class="order-products-row">
                <div style="font-size:0.9rem; color:var(--text-muted);">
                  Ref: <strong style="color:var(--primary);">#ORD-${order.id}</strong>
                </div>
                <button onclick="openOrderDetail(${order.id})" class="btn btn-outline btn-sm">
                  View Details
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load orders history:', err);
    container.innerHTML = `<div class="alert alert-error">Error loading order history.</div>`;
  }
}

/**
 * Configures actions and elements inside the floating Order Details popup.
 */
function setupOrderDetailsModal() {
  const modal = document.getElementById('order-detail-modal');
  const closeBtn = document.getElementById('modal-close-btn');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    // Close on overlay clicking
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  }
}

/**
 * Triggers modal load and queries detailed order lines from API.
 */
async function openOrderDetail(orderId) {
  const modal = document.getElementById('order-detail-modal');
  const itemsContainer = document.getElementById('modal-items-container');
  
  if (!modal || !itemsContainer) return;

  // Open modal in loading status
  modal.classList.add('active');
  itemsContainer.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetchWithAuth(`/api/orders/detail/${orderId}`);

    if (res.success) {
      const order = res.order;
      const items = res.items;

      // Update modal metadata
      document.getElementById('modal-order-id').textContent = `ORD-${order.id}`;
      document.getElementById('modal-order-date').textContent = new Date(order.created_at).toLocaleDateString();
      document.getElementById('modal-order-status').className = `badge badge-${order.status}`;
      document.getElementById('modal-order-status').textContent = order.status.toUpperCase();
      
      document.getElementById('modal-ship-address').textContent = order.shipping_address;
      document.getElementById('modal-ship-phone').textContent = order.phone_number;

      // Populate line items table rows
      let itemsHtml = `
        <table class="admin-table" style="width:100%; border-collapse:collapse; margin-top:1rem;">
          <thead>
            <tr>
              <th style="text-align:left; background:var(--surface-secondary); padding:0.5rem 1rem;">Item</th>
              <th style="text-align:right; background:var(--surface-secondary); padding:0.5rem 1rem;">Price</th>
              <th style="text-align:center; background:var(--surface-secondary); padding:0.5rem 1rem;">Qty</th>
              <th style="text-align:right; background:var(--surface-secondary); padding:0.5rem 1rem;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
      `;

      items.forEach(item => {
        const subtotal = parseFloat(item.price) * item.quantity;
        itemsHtml += `
          <tr>
            <td style="padding:0.75rem 1rem; border-bottom:1px solid var(--border);">
              <div style="font-weight:700;">${item.title || 'Product Deleted'}</div>
            </td>
            <td style="text-align:right; padding:0.75rem 1rem; border-bottom:1px solid var(--border);">${formatPrice(item.price)}</td>
            <td style="text-align:center; padding:0.75rem 1rem; border-bottom:1px solid var(--border);">${item.quantity}</td>
            <td style="text-align:right; padding:0.75rem 1rem; border-bottom:1px solid var(--border); font-weight:700; color:var(--primary);">${formatPrice(subtotal)}</td>
          </tr>
        `;
      });

      itemsHtml += `
          </tbody>
        </table>
        <div style="text-align:right; margin-top:1.5rem; font-family:var(--font-display); font-size:1.2rem; font-weight:800;">
          Order Total: <span style="color:var(--accent);">${formatPrice(order.total_amount)}</span>
        </div>
      `;

      itemsContainer.innerHTML = itemsHtml;
    } else {
      itemsContainer.innerHTML = `<div class="alert alert-error">${res.message || 'Error loading order details.'}</div>`;
    }
  } catch (err) {
    console.error('Failed to load order line detail:', err);
    itemsContainer.innerHTML = '<div class="alert alert-error">Error loading detailed order info.</div>';
  }
}
