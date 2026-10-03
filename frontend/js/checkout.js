// ShopSphere Checkout Client Script
// Validates customer checkout details, displays orders summaries, and places transaction orders

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('checkout-form')) {
    initCheckoutPage();
  }
});

let cartTotal = 0;

/**
 * Initializes the checkout process, loading cart summaries and protecting empty states.
 */
async function initCheckoutPage() {
  const recapContainer = document.getElementById('order-recap-container');
  const checkoutForm = document.getElementById('checkout-form');
  
  if (!recapContainer || !checkoutForm) return;

  try {
    // 1. Fetch current cart
    const res = await fetchWithAuth('/api/cart');
    
    if (res.success) {
      const items = res.cartItems;

      if (items.length === 0) {
        showNotification('Your cart is empty. Redirecting to catalog...', 'error');
        setTimeout(() => { window.location.href = '/products.html'; }, 1000);
        return;
      }

      // 2. Render item list recap
      let html = '';
      let subtotal = 0;

      items.forEach(item => {
        const itemTotal = parseFloat(item.price) * item.quantity;
        subtotal += itemTotal;

        html += `
          <div class="recap-item">
            <div class="recap-item-title">${item.title} (x${item.quantity})</div>
            <div style="font-weight:600;">${formatPrice(itemTotal)}</div>
          </div>
        `;
      });

      recapContainer.innerHTML = html;

      // 3. Compute totals matching cart calculations
      const shipping = subtotal > 150 ? 0 : 9.99;
      const tax = subtotal * 0.05;
      cartTotal = subtotal + shipping + tax;

      document.getElementById('recap-subtotal').textContent = formatPrice(subtotal);
      document.getElementById('recap-shipping').textContent = shipping === 0 ? 'FREE' : formatPrice(shipping);
      document.getElementById('recap-tax').textContent = formatPrice(tax);
      document.getElementById('recap-total').textContent = formatPrice(cartTotal);

      // 4. Handle checkout submission
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const address = document.getElementById('shipping-address').value.trim();
        const phone = document.getElementById('phone-number').value.trim();

        if (!address || !phone) {
          showNotification('Please fill in your shipping details.', 'error');
          return;
        }

        // Basic phone number length validation
        if (phone.length < 10) {
          showNotification('Please enter a valid phone number (at least 10 digits).', 'error');
          return;
        }

        submitOrder(address, phone);
      });
    }
  } catch (err) {
    console.error('Checkout initialization error:', err);
    showNotification('Error loading checkout parameters.', 'error');
  }
}

/**
 * Sends POST request to create an order transaction in backend.
 */
async function submitOrder(address, phone) {
  const submitBtn = document.querySelector('#checkout-form button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing Transaction...';
  }

  try {
    const res = await fetchWithAuth('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        shipping_address: address,
        phone_number: phone
      })
    });

    if (res.success) {
      showNotification('Order placed successfully!', 'success');
      updateCartBadgeCount();
      renderSuccessScreen(res.orderId, cartTotal, address);
    } else {
      showNotification(res.message || 'Checkout failed. Please try again.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Order';
      }
    }
  } catch (err) {
    console.error('Checkout API submission failed:', err);
    showNotification('Could not connect to database. Try again.', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Place Order';
    }
  }
}

/**
 * Replaces the checkout screens with a stunning confirmation receipt dashboard.
 */
function renderSuccessScreen(orderId, total, address) {
  const mainContainer = document.querySelector('main .container');
  if (!mainContainer) return;

  mainContainer.innerHTML = `
    <div class="checkout-success-pane">
      <div class="success-icon">🎉</div>
      <h2 class="success-title">Thank You For Your Order!</h2>
      <p class="success-text">
        Your order has been successfully placed. We have initialized processing and will notify you soon!
      </p>
      
      <div style="background: var(--surface-secondary); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border); text-align: left; margin-bottom: 2rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="font-weight:600; color:var(--text-muted);">Order ID:</span>
          <span style="font-weight:800; color:var(--primary);">#${orderId}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="font-weight:600; color:var(--text-muted);">Amount Charged:</span>
          <span style="font-weight:800; color:var(--accent);">${formatPrice(total)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="font-weight:600; color:var(--text-muted);">Shipped To:</span>
          <span style="font-weight:600; color:var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">${address}</span>
        </div>
      </div>

      <div style="display:flex; justify-content:center; gap:1.25rem;">
        <a href="/orders.html" class="btn btn-outline">Track My Orders</a>
        <a href="/products.html" class="btn btn-primary">Continue Shopping</a>
      </div>
    </div>
  `;
}
