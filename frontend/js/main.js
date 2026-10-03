// ShopSphere Global Client Script
// Manages global JWT session handling, REST fetch helpers, navbar states, cart badges, and visual alerts

// Base API URL. Since we serve the frontend statically, it connects to the same origin.
const API_BASE_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

/**
 * Initializes application-wide state, session guards, and header linkages.
 */
function initApp() {
  setupNavbar();
  checkPageAuthGuards();
  updateCartBadgeCount();
}

/**
 * Helper to retrieve stored token from localStorage.
 */
function getToken() {
  return localStorage.getItem('shopsphere_token');
}

/**
 * Helper to retrieve stored user payload from localStorage.
 */
function getUser() {
  const userJson = localStorage.getItem('shopsphere_user');
  try {
    return userJson ? JSON.parse(userJson) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Checks if user is authenticated.
 */
function isAuthenticated() {
  return !!getToken();
}

/**
 * Checks if logged-in user is an administrator.
 */
function isAdminUser() {
  const user = getUser();
  return user && user.role === 'admin';
}

/**
 * Perform logout operation.
 * Clears localStorage session keys and redirects.
 */
function logout() {
  localStorage.removeItem('shopsphere_token');
  localStorage.removeItem('shopsphere_user');
  showNotification('Logged out successfully.', 'success');
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 1000);
}

/**
 * Dynamically adjusts the navigation links and controls based on login state and roles.
 */
function setupNavbar() {
  const navActions = document.getElementById('nav-actions');
  const navMenu = document.getElementById('nav-menu');
  if (!navActions || !navMenu) return;

  const loggedIn = isAuthenticated();
  const isAdmin = isAdminUser();
  const user = getUser();

  // 1. Render primary navigation links
  let menuHtml = `
    <li><a href="/index.html" class="nav-link ${isActivePage('index') ? 'active' : ''}">Home</a></li>
    <li><a href="/products.html" class="nav-link ${isActivePage('products') ? 'active' : ''}">Products</a></li>
  `;

  if (loggedIn) {
    menuHtml += `
      <li><a href="/orders.html" class="nav-link ${isActivePage('orders') ? 'active' : ''}">My Orders</a></li>
    `;
    if (isAdmin) {
      menuHtml += `
        <li><a href="/admin.html" class="nav-link ${isActivePage('admin') ? 'active' : ''}">Admin Panel</a></li>
      `;
    }
  }

  navMenu.innerHTML = menuHtml;

  // 2. Render account controls (Login / Profile / Logout)
  if (loggedIn) {
    navActions.innerHTML = `
      <span class="user-welcome" style="font-size: 0.9rem; font-weight: 600; color: var(--text-muted);">
        Hi, ${user.name.split(' ')[0]} ${isAdmin ? '(Admin)' : ''}
      </span>
      <a href="/cart.html" class="cart-icon-wrapper" title="View Cart">
        🛒
        <span id="nav-cart-badge" class="cart-badge" style="display: none;">0</span>
      </a>
      <button onclick="logout()" class="btn btn-outline btn-sm" style="padding: 0.5rem 1rem;">Logout</button>
    `;
  } else {
    navActions.innerHTML = `
      <a href="/cart.html" class="cart-icon-wrapper" title="View Cart">
        🛒
        <span id="nav-cart-badge" class="cart-badge" style="display: none;">0</span>
      </a>
      <a href="/login.html" class="btn btn-outline btn-sm" style="padding: 0.5rem 1rem;">Login</a>
      <a href="/register.html" class="btn btn-primary btn-sm" style="padding: 0.5rem 1rem;">Register</a>
    `;
  }
}

/**
 * Helper to identify if a menu link matches the current active page.
 */
function isActivePage(pageName) {
  const path = window.location.pathname;
  if (pageName === 'index' && (path === '/' || path.includes('index.html'))) {
    return true;
  }
  return path.includes(pageName);
}

/**
 * Client-side page authorization routes protection.
 * Redirects unauthenticated users attempting to access dashboard or cart endpoints.
 */
function checkPageAuthGuards() {
  const path = window.location.pathname.toLowerCase();
  const loggedIn = isAuthenticated();
  const isAdmin = isAdminUser();

  // Pages requiring basic user login
  const protectedUserPages = ['/cart.html', '/checkout.html', '/orders.html'];
  const isProtectedUser = protectedUserPages.some(page => path.includes(page));

  // Pages requiring admin role
  const isProtectedAdmin = path.includes('/admin.html');

  if (isProtectedAdmin) {
    if (!loggedIn) {
      window.location.href = '/login.html?redirect=admin.html';
    } else if (!isAdmin) {
      alert('Access Denied. Admin permissions required.');
      window.location.href = '/index.html';
    }
  } else if (isProtectedUser && !loggedIn) {
    // Extract base page name
    const pageName = path.substring(path.lastIndexOf('/') + 1);
    window.location.href = `/login.html?redirect=${pageName}`;
  }
}

/**
 * Refreshes the cart badge count in the navigation bar from the backend.
 */
async function updateCartBadgeCount() {
  const badgeEl = document.getElementById('nav-cart-badge');
  if (!badgeEl) return;

  if (!isAuthenticated()) {
    badgeEl.style.display = 'none';
    return;
  }

  try {
    const response = await fetchWithAuth('/api/cart');
    if (response.success && response.cartItems) {
      const totalQty = response.cartItems.reduce((acc, item) => acc + item.quantity, 0);
      
      if (totalQty > 0) {
        badgeEl.textContent = totalQty;
        badgeEl.style.display = 'flex';
      } else {
        badgeEl.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Failed to sync cart count badge:', error);
  }
}

/**
 * Custom wrappers for fetch calls that automatically append the JWT authorization header.
 */
async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers
  });

  // Automatically handle expired tokens or unauth states
  if (response.status === 401 && token) {
    localStorage.removeItem('shopsphere_token');
    localStorage.removeItem('shopsphere_user');
    window.location.href = '/login.html?session=expired';
    return { success: false, message: 'Session expired. Please log in again.' };
  }

  return response.json();
}

/**
 * Displays a beautiful floating non-blocking screen notification alert.
 * @param {string} message - Message text.
 * @param {string} type - 'success' or 'error'.
 */
function showNotification(message, type = 'success') {
  // Check if notification container exists, else create it
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.style.position = 'fixed';
    container.style.top = '100px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }

  const alertEl = document.createElement('div');
  alertEl.className = `alert alert-${type}`;
  alertEl.style.margin = '0';
  alertEl.style.boxShadow = 'var(--shadow-lg)';
  alertEl.innerHTML = `
    <span>${type === 'success' ? '✅' : '❌'}</span>
    <div>${message}</div>
  `;

  container.appendChild(alertEl);

  // Automatically fade and remove
  setTimeout(() => {
    alertEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    alertEl.style.opacity = '0';
    alertEl.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      alertEl.remove();
    }, 500);
  }, 3000);
}

/**
 * Dynamic price formatter.
 */
function formatPrice(amount) {
  return `$${parseFloat(amount).toFixed(2)}`;
}
