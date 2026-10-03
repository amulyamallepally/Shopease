// ShopSphere Admin Dashboard Script
// Integrates Product CRUD operations, order shipment status controls, and user lists

let editingProductId = null;
let globalCategories = [];

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('admin-sidebar')) {
    initAdminDashboard();
  }
});

/**
 * Initializes the administrative suite, binding events and listing active tabs.
 */
async function initAdminDashboard() {
  setupTabNavigation();
  setupProductFormModal();
  
  // Load global master data
  await loadCategoriesDropdown();
  await loadDashboardStats();
  await loadAdminProducts();
  await loadAdminOrders();
  await loadAdminUsers();
}

/**
 * Switch views between tabs on sidebar clicks.
 */
function setupTabNavigation() {
  const buttons = document.querySelectorAll('.admin-menu-btn');
  const panes = document.querySelectorAll('.admin-pane');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const paneId = btn.dataset.pane;
      document.getElementById(paneId).classList.add('active');
    });
  });
}

/**
 * Pre-populates category select list inside addition forms.
 */
async function loadCategoriesDropdown() {
  const select = document.getElementById('prod-category');
  if (!select) return;

  try {
    const res = await fetch('/api/products/categories');
    const data = await res.json();
    if (data.success) {
      globalCategories = data.categories;
      select.innerHTML = `
        <option value="">-- Choose Category --</option>
        ${globalCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
      `;
    }
  } catch (err) {
    console.error('Failed to load categories list dropdown:', err);
  }
}

/**
 * Aggregates lengths and sums from core APIs to display dynamic statistics card logs.
 */
async function loadDashboardStats() {
  try {
    // 1. Fetch products count
    const prodRes = await fetch('/api/products');
    const prodData = await prodRes.json();
    const totalProds = prodData.success ? prodData.products.length : 0;

    // 2. Fetch users count
    const userRes = await fetchWithAuth('/api/auth/users');
    const userData = await userRes.json();
    const totalUsers = userData.success ? userData.users.length : 0;

    // 3. Fetch orders list
    const orderRes = await fetchWithAuth('/api/orders/admin/all');
    const orderData = await orderRes.json();
    
    let totalOrders = 0;
    let totalRevenue = 0;
    
    if (orderData.success) {
      totalOrders = orderData.orders.length;
      totalRevenue = orderData.orders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
    }

    // Bind values to UI elements
    document.getElementById('stat-products').textContent = totalProds;
    document.getElementById('stat-orders').textContent = totalOrders;
    document.getElementById('stat-revenue').textContent = formatPrice(totalRevenue);

  } catch (err) {
    console.error('Failed to compute dashboard stats:', err);
  }
}

/* ========================================================
   1. PRODUCTS CRUD OPERATIONS
   ======================================================== */

/**
 * Loads products inside admin panel table.
 */
let currentImageSourceMode = 'file'; // 'file' or 'url'

/**
 * Switch image selection input mode between Local File Upload and External URL Input.
 */
function toggleImageSourceMode() {
  const fileWrapper = document.getElementById('image-source-file-wrapper');
  const urlWrapper = document.getElementById('image-source-url-wrapper');
  const toggleBtn = document.getElementById('img-source-toggle');
  const urlInput = document.getElementById('prod-image');
  const fileInput = document.getElementById('prod-image-file');

  if (currentImageSourceMode === 'file') {
    currentImageSourceMode = 'url';
    fileWrapper.style.display = 'none';
    urlWrapper.style.display = 'block';
    toggleBtn.textContent = 'Switch to File Upload';
    fileInput.value = ''; // Reset uploader file
  } else {
    currentImageSourceMode = 'file';
    fileWrapper.style.display = 'block';
    urlWrapper.style.display = 'none';
    toggleBtn.textContent = 'Switch to URL Input';
    urlInput.value = ''; // Reset text url
  }
}

/**
 * Loads products inside admin panel table.
 */
async function loadAdminProducts() {
  const tbody = document.getElementById('admin-products-body');
  if (!tbody) return;

  try {
    const res = await fetch('/api/products');
    const data = await res.json();

    if (data.success) {
      tbody.innerHTML = data.products.map(prod => `
        <tr>
          <td><strong>#PRD-${prod.id}</strong></td>
          <td>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-weight: 600;">${prod.title}</span>
              <span class="admin-bestseller-badge ${prod.is_bestseller ? 'active' : ''}" onclick="toggleAdminBestSeller(${prod.id})" title="${prod.is_bestseller ? 'Designated Homepage Best Seller' : 'Click to set as Homepage Best Seller'}">
                ${prod.is_bestseller ? '⭐ Bestseller' : '☆ Set Bestseller'}
              </span>
            </div>
          </td>
          <td><span class="badge badge-shipped">${prod.category_name}</span></td>
          <td style="font-weight:700; color:var(--accent);">${formatPrice(prod.price)}</td>
          <td><strong>${prod.stock}</strong> units</td>
          <td>
            <div style="display:flex; gap:0.5rem;">
              <button onclick="openEditProductModal(${JSON.stringify(prod).replace(/"/g, '&quot;')})" class="btn btn-outline btn-sm" style="padding:0.4rem 0.6rem;">Edit</button>
              <button onclick="deleteProduct(${prod.id})" class="btn btn-danger btn-sm" style="padding:0.4rem 0.6rem;">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load admin products:', err);
  }
}

/**
 * Sets up listeners for the floating product forms modal.
 */
function setupProductFormModal() {
  const modal = document.getElementById('product-modal');
  const closeBtn = document.getElementById('product-modal-close');
  const cancelBtn = document.getElementById('btn-modal-cancel');
  const form = document.getElementById('product-form');
  const fileInput = document.getElementById('prod-image-file');
  const urlInput = document.getElementById('prod-image');
  const previewImg = document.getElementById('img-upload-preview-img');
  const placeholderText = document.getElementById('img-upload-placeholder-text');

  if (closeBtn && modal) {
    const closeModal = () => {
      modal.classList.remove('active');
      form.reset();
      editingProductId = null;
      resetPreviewState();
    };

    closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveProduct();
    });
  }

  // 1. File Input handler (automatic base64 uploader)
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show temporary loading indicator in uploader preview box
      if (placeholderText) placeholderText.innerHTML = '⚡ Uploading picture to server...';
      if (previewImg) previewImg.style.display = 'none';

      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target.result;
          
          // Submit image base64 data to backend upload endpoint
          const uploadRes = await fetchWithAuth('/api/products/upload', {
            method: 'POST',
            body: JSON.stringify({ base64Data })
          });

          if (uploadRes.success && uploadRes.image_url) {
            // Store final path in the hidden URL input
            if (urlInput) urlInput.value = uploadRes.image_url;
            
            // Set uploader visual preview
            if (previewImg) {
              previewImg.src = uploadRes.image_url;
              previewImg.style.display = 'block';
            }
            if (placeholderText) placeholderText.style.display = 'none';
            showNotification('Image uploaded and synced successfully!', 'success');
          } else {
            showNotification(uploadRes.message || 'Image upload failed.', 'error');
            resetPreviewState();
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('File reading failed:', err);
        showNotification('Failed to process image file.', 'error');
        resetPreviewState();
      }
    });
  }

  // 2. URL Input listener for live typing preview
  if (urlInput) {
    urlInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        if (previewImg) {
          previewImg.src = val;
          previewImg.style.display = 'block';
        }
        if (placeholderText) placeholderText.style.display = 'none';
      } else {
        resetPreviewState();
      }
    });
  }
}

function resetPreviewState() {
  const previewImg = document.getElementById('img-upload-preview-img');
  const placeholderText = document.getElementById('img-upload-placeholder-text');
  if (previewImg) {
    previewImg.src = '';
    previewImg.style.display = 'none';
  }
  if (placeholderText) {
    placeholderText.innerHTML = `No picture selected.<br><span style="font-size:0.75rem; color:var(--text-muted);">Upload a file or enter a URL to see live preview.</span>`;
    placeholderText.style.display = 'block';
  }
}

function openAddProductModal() {
  editingProductId = null;
  document.getElementById('modal-title').textContent = 'Add New Product';
  document.getElementById('product-form').reset();
  
  // Enforce uploader source mode to File by default
  currentImageSourceMode = 'url';
  toggleImageSourceMode();
  resetPreviewState();

  document.getElementById('product-modal').classList.add('active');
}

function openEditProductModal(product) {
  editingProductId = product.id;
  document.getElementById('modal-title').textContent = 'Edit Product details';
  
  // Fill inputs
  document.getElementById('prod-title').value = product.title;
  document.getElementById('prod-price').value = product.price;
  document.getElementById('prod-category').value = product.category_id || '';
  document.getElementById('prod-stock').value = product.stock;
  document.getElementById('prod-image').value = product.image_url || '';
  document.getElementById('prod-desc').value = product.description || '';

  // Render visual image preview
  const previewImg = document.getElementById('img-upload-preview-img');
  const placeholderText = document.getElementById('img-upload-placeholder-text');
  
  if (product.image_url) {
    if (previewImg) {
      previewImg.src = product.image_url;
      previewImg.style.display = 'block';
    }
    if (placeholderText) placeholderText.style.display = 'none';
  } else {
    resetPreviewState();
  }

  // Force mode to URL input since editing already has an image path
  currentImageSourceMode = 'file';
  toggleImageSourceMode();

  document.getElementById('product-modal').classList.add('active');
}

/**
 * Triggers API call to set any product as the active Homepage Best Seller.
 */
async function toggleAdminBestSeller(productId) {
  try {
    const res = await fetchWithAuth(`/api/products/bestseller/${productId}`, {
      method: 'PUT'
    });

    if (res.success) {
      showNotification('Best Seller product updated successfully!', 'success');
      await loadAdminProducts();
      await loadDashboardStats();
    } else {
      showNotification(res.message || 'Failed to update Best Seller product.', 'error');
    }
  } catch (err) {
    console.error('Best seller update error:', err);
    showNotification('Error setting bestseller product.', 'error');
  }
}

/**
 * Triggers API call to insert or modify product properties in database.
 */
async function saveProduct() {
  const title = document.getElementById('prod-title').value.trim();
  const price = document.getElementById('prod-price').value.trim();
  const category_id = document.getElementById('prod-category').value;
  const stock = document.getElementById('prod-stock').value.trim();
  const image_url = document.getElementById('prod-image').value.trim();
  const description = document.getElementById('prod-desc').value.trim();

  if (!title || !price || !category_id || !stock) {
    showNotification('Please fill in all required parameters.', 'error');
    return;
  }

  const payload = {
    title,
    price: parseFloat(price),
    category_id: parseInt(category_id, 10),
    stock: parseInt(stock, 10),
    image_url,
    description
  };

  const isEditing = editingProductId !== null;
  const url = isEditing ? `/api/products/${editingProductId}` : '/api/products';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const res = await fetchWithAuth(url, {
      method,
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showNotification(res.message || 'Product saved successfully!', 'success');
      document.getElementById('product-modal').classList.remove('active');
      document.getElementById('product-form').reset();
      editingProductId = null;
      
      // Refresh items
      await loadAdminProducts();
      await loadDashboardStats();
    } else {
      showNotification(res.message || 'Failed to save product details.', 'error');
    }
  } catch (err) {
    console.error('Failed to save product details:', err);
  }
}

/**
 * Triggers DELETE request to delete a product.
 */
async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product? All cart entries of this product will also be updated.')) return;

  try {
    const res = await fetchWithAuth(`/api/products/${productId}`, {
      method: 'DELETE'
    });

    if (res.success) {
      showNotification('Product deleted successfully.', 'success');
      await loadAdminProducts();
      await loadDashboardStats();
    } else {
      showNotification(res.message || 'Failed to delete product.', 'error');
    }
  } catch (err) {
    console.error('Product deletion error:', err);
  }
}

/* ========================================================
   2. ORDERS ADMINISTRATIVE DASHBOARD
   ======================================================== */

/**
 * Loads order transactions inside admin orders list table.
 */
async function loadAdminOrders() {
  const tbody = document.getElementById('admin-orders-body');
  if (!tbody) return;

  try {
    const res = await fetchWithAuth('/api/orders/admin/all');

    if (res.success) {
      tbody.innerHTML = res.orders.map(order => {
        const dateStr = new Date(order.created_at).toLocaleDateString();
        
        return `
          <tr>
            <td><strong>#ORD-${order.id}</strong></td>
            <td>
              <div style="font-weight:600;">${order.user_name}</div>
              <span style="font-size:0.8rem; color:var(--text-muted);">${order.user_email}</span>
            </td>
            <td>${dateStr}</td>
            <td style="font-weight:700; color:var(--accent);">${formatPrice(order.total_amount)}</td>
            <td>
              <select onchange="updateAdminOrderStatus(${order.id}, this.value)" class="form-control" style="padding:0.4rem; font-size:0.85rem; width:130px; font-weight:600;">
                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load administrative orders:', err);
  }
}

/**
 * Triggered when changing status select inputs.
 */
async function updateAdminOrderStatus(orderId, newStatus) {
  try {
    const res = await fetchWithAuth(`/api/orders/admin/status/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });

    if (res.success) {
      showNotification(`Order status updated to ${newStatus}.`, 'success');
      await loadDashboardStats();
    } else {
      showNotification(res.message || 'Failed to update order status.', 'error');
    }
  } catch (err) {
    console.error('Status change error:', err);
  }
}

/* ========================================================
   3. USERS MANAGEMENT
   ======================================================== */

/**
 * Loads registered user details table.
 */
async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-body');
  if (!tbody) return;

  try {
    const res = await fetchWithAuth('/api/auth/users');

    if (res.success) {
      tbody.innerHTML = res.users.map(user => {
        const dateStr = new Date(user.created_at).toLocaleDateString();
        
        return `
          <tr>
            <td><strong>#USR-${user.id}</strong></td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>
              <span class="badge ${user.role === 'admin' ? 'badge-delivered' : 'badge-shipped'}" style="font-weight:700;">
                ${user.role.toUpperCase()}
              </span>
            </td>
            <td>${dateStr}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load registered accounts:', err);
  }
}
