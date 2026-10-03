// ShopSphere Products Script
// Powers product catalog listing, filtering, search, sorting, details presentation, and cart integration

let activeCategory = '';
let activeSearch = '';
let activeSort = '';

document.addEventListener('DOMContentLoaded', () => {
  // Check which page we are currently browsing and route initialization
  if (document.getElementById('products-grid')) {
    initCatalogPage();
  } else if (document.getElementById('detail-title')) {
    initDetailsPage();
  } else if (document.getElementById('featured-products-grid')) {
    initHomePage();
  }
});

/* ========================================================
   1. HOME PAGE LOGIC
   ======================================================== */
async function initHomePage() {
  const featuredGrid = document.getElementById('featured-products-grid');
  const categoriesGrid = document.getElementById('home-categories-grid');

  // Load 4 categories on homepage
  if (categoriesGrid) {
    try {
      const res = await fetch('/api/products/categories');
      const data = await res.json();
      if (data.success) {
        categoriesGrid.innerHTML = data.categories.slice(0, 4).map(cat => `
          <div class="category-card" onclick="navigateToCategory(${cat.id})">
            <div class="category-icon">${getCategoryEmoji(cat.name)}</div>
            <h3>${cat.name}</h3>
            <p>${cat.description || 'Stunning collection'}</p>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Home categories load error:', err);
    }
  }

  // Load featured products (limit to 3 or 4 for beautiful layout)
  if (featuredGrid) {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success && data.products) {
        const featured = data.products.slice(0, 4); // Limit to top 4 products
        featuredGrid.innerHTML = renderProductGridHtml(featured);
        
        // Find best seller product dynamically
        const bestSeller = data.products.find(p => p.is_bestseller === 1) || data.products[1] || data.products[0];
        if (bestSeller) {
          renderHeroBestSellerCard(bestSeller);
        }
      }
    } catch (err) {
      console.error('Home featured products load error:', err);
      featuredGrid.innerHTML = `<div class="alert alert-error">Failed to load featured products.</div>`;
    }
  }
}

/**
 * Dynamically populates the hero section bestseller card using real DB product parameters.
 */
function renderHeroBestSellerCard(prod) {
  const cardEl = document.getElementById('hero-bestseller-card');
  const imgEl = document.getElementById('hero-bestseller-img');
  const titleEl = document.getElementById('hero-bestseller-title');
  const descEl = document.getElementById('hero-bestseller-desc');
  const priceEl = document.getElementById('hero-bestseller-price');
  const btnEl = document.getElementById('hero-bestseller-btn');
  
  if (titleEl) titleEl.textContent = prod.title;
  if (descEl) descEl.textContent = prod.description || 'Feel Every Beat. Live Every Moment.';
  if (priceEl) priceEl.textContent = formatPrice(prod.price);
  
  if (imgEl) {
    if (prod.image_url) {
      imgEl.src = prod.image_url;
      imgEl.alt = prod.title;
      imgEl.style.display = 'block';
      if (imgEl.nextElementSibling) {
        imgEl.nextElementSibling.style.display = 'none';
      }
    } else {
      imgEl.style.display = 'none';
      if (imgEl.nextElementSibling) {
        imgEl.nextElementSibling.innerHTML = getProductEmoji(prod.category_name);
        imgEl.nextElementSibling.style.display = 'block';
      }
    }
  }

  if (btnEl) {
    btnEl.onclick = () => {
      window.location.href = `/product-details.html?id=${prod.id}`;
    };
  }
}

function navigateToCategory(catId) {
  window.location.href = `/products.html?category=${catId}`;
}

/* ========================================================
   2. CATALOG PAGE LOGIC
   ======================================================== */
async function initCatalogPage() {
  // 1. Sync filters from URL parameters if returning from homepage
  const urlParams = new URLSearchParams(window.location.search);
  activeCategory = urlParams.get('category') || '';
  activeSearch = urlParams.get('search') || '';

  // Set initial search value in input field if present
  const searchInput = document.getElementById('search-input');
  if (searchInput && activeSearch) {
    searchInput.value = activeSearch;
  }

  // 2. Wire event listeners for catalog filters
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      activeSort = e.target.value;
      loadProducts();
    });
  }

  const searchForm = document.getElementById('catalog-search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('search-input');
      activeSearch = input ? input.value.trim() : '';
      loadProducts();
    });
  }

  // 3. Load catalog data
  await loadCategoriesSidebar();
  await loadProducts();
}

/**
 * Loads and lists categories inside the left-sidebar container.
 */
async function loadCategoriesSidebar() {
  const sidebarList = document.getElementById('sidebar-categories-list');
  if (!sidebarList) return;

  try {
    const res = await fetch('/api/products/categories');
    const data = await res.json();

    if (data.success) {
      let html = `
        <a href="#" class="filter-tag-link ${!activeCategory ? 'active' : ''}" onclick="selectCategory(event, '')">
          <span>All Categories</span>
        </a>
      `;

      data.categories.forEach(cat => {
        const isActive = activeCategory == cat.id;
        html += `
          <a href="#" class="filter-tag-link ${isActive ? 'active' : ''}" onclick="selectCategory(event, '${cat.id}')">
            <span>${cat.name}</span>
          </a>
        `;
      });

      sidebarList.innerHTML = html;
    }
  } catch (err) {
    console.error('Sidebar categories load error:', err);
  }
}

/**
 * Triggered when clicking a category name in the sidebar.
 */
function selectCategory(event, categoryId) {
  if (event) event.preventDefault();
  activeCategory = categoryId;
  
  // Highlight chosen link in sidebar
  const links = document.querySelectorAll('.filter-tag-link');
  links.forEach(l => l.classList.remove('active'));
  
  // Highlight the clicked element or matching element
  if (event) {
    event.currentTarget.classList.add('active');
  }

  // Update URL state without refreshing page
  const url = new URL(window.location);
  if (categoryId) {
    url.searchParams.set('category', categoryId);
  } else {
    url.searchParams.delete('category');
  }
  window.history.pushState({}, '', url);

  loadProducts();
}

/**
 * Queries catalog products from backend using current search, category, and sorting settings.
 */
async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="spinner"></div>';

  try {
    let queryUrl = `/api/products?sort=${activeSort}`;
    if (activeCategory) queryUrl += `&category=${activeCategory}`;
    if (activeSearch) queryUrl += `&search=${encodeURIComponent(activeSearch)}`;

    const res = await fetch(queryUrl);
    const data = await res.json();

    if (data.success) {
      if (data.products.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">🔎</div>
            <h3>No products found</h3>
            <p>We couldn't find any products matching your active filters. Try adjustments!</p>
            <button class="btn btn-primary" onclick="resetFilters()">Reset All Filters</button>
          </div>
        `;
      } else {
        grid.innerHTML = renderProductGridHtml(data.products);
      }
    }
  } catch (err) {
    console.error('Products load error:', err);
    grid.innerHTML = `<div class="alert alert-error" style="grid-column: 1 / -1;">Error retrieving catalog products.</div>`;
  }
}

function resetFilters() {
  activeSearch = '';
  activeCategory = '';
  activeSort = '';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = '';
  
  // Reset URL
  const url = new URL(window.location);
  url.search = '';
  window.history.pushState({}, '', url);

  loadCategoriesSidebar();
  loadProducts();
}

/**
 * Builds standard layout grids of product items.
 */
function renderProductGridHtml(productsList) {
  return productsList.map(prod => `
    <div class="product-card">
      <div class="product-img-wrapper">
        <span class="product-category-tag">${prod.category_name}</span>
        ${prod.image_url ? `<img src="${prod.image_url}" alt="${prod.title}" class="product-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
        <div class="product-img-placeholder" style="${prod.image_url ? 'display: none;' : ''}">
          ${getProductEmoji(prod.category_name)}
          <span style="font-size:0.9rem; padding:0 0.5rem; text-align:center;">${prod.title}</span>
        </div>
      </div>
      <div class="product-info">
        <h3 class="product-title"><a href="/product-details.html?id=${prod.id}">${prod.title}</a></h3>
        <p class="product-description">${prod.description || 'High-quality item.'}</p>
        <div class="product-footer">
          <span class="product-price">${formatPrice(prod.price)}</span>
          <button onclick="quickAddToCart(${prod.id})" class="btn btn-primary btn-sm" ${prod.stock <= 0 ? 'disabled' : ''}>
            ${prod.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

/* ========================================================
   3. PRODUCT DETAILS LOGIC
   ======================================================== */
let detailProduct = null;

async function initDetailsPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  if (!id) {
    showNotification('Product identifier is missing. Redirecting...', 'error');
    setTimeout(() => { window.location.href = '/products.html'; }, 1500);
    return;
  }

  // Wire interactive selectors
  const qtyInc = document.getElementById('qty-inc');
  const qtyDec = document.getElementById('qty-dec');
  const qtyInput = document.getElementById('qty-input');
  const addToCartBtn = document.getElementById('add-to-cart-btn');

  if (qtyInc && qtyDec && qtyInput) {
    qtyInc.addEventListener('click', () => {
      let currentVal = parseInt(qtyInput.value, 10);
      if (detailProduct && currentVal < detailProduct.stock) {
        qtyInput.value = currentVal + 1;
      }
    });

    qtyDec.addEventListener('click', () => {
      let currentVal = parseInt(qtyInput.value, 10);
      if (currentVal > 1) {
        qtyInput.value = currentVal - 1;
      }
    });
  }

  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', () => {
      if (!isAuthenticated()) {
        window.location.href = '/login.html?redirect=product-details.html?id=' + id;
        return;
      }
      const quantity = parseInt(qtyInput.value, 10);
      executeAddToCart(id, quantity);
    });
  }

  await loadProductDetails(id);
}

/**
 * Fetches and displays detailed product parameters.
 */
async function loadProductDetails(productId) {
  try {
    const res = await fetch(`/api/products/${productId}`);
    const data = await res.json();

    if (data.success && data.product) {
      detailProduct = data.product;
      
      // Update HTML elements
      document.getElementById('detail-title').textContent = detailProduct.title;
      document.getElementById('detail-category').textContent = detailProduct.category_name;
      document.getElementById('detail-price').textContent = formatPrice(detailProduct.price);
      document.getElementById('detail-desc').textContent = detailProduct.description || 'No description available for this product.';
      
      // Image Thumbnail Render
      const imgContainer = document.getElementById('detail-img-pane');
      if (imgContainer) {
        if (detailProduct.image_url) {
          imgContainer.innerHTML = `
            <img src="${detailProduct.image_url}" alt="${detailProduct.title}" class="detail-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="product-img-placeholder" style="display: none; width:100%; height:100%;">
              ${getProductEmoji(detailProduct.category_name)}
              <span style="font-size:0.9rem; padding:0 1rem;">${detailProduct.title}</span>
            </div>
          `;
        } else {
          imgContainer.innerHTML = `
            <div class="product-img-placeholder" style="width:100%; height:100%;">
              ${getProductEmoji(detailProduct.category_name)}
              <span style="font-size:0.9rem; padding:0 1rem;">${detailProduct.title}</span>
            </div>
          `;
        }
      }

      // Stock Badge Adjustments
      const dot = document.getElementById('stock-dot');
      const text = document.getElementById('stock-text');
      const actionBtn = document.getElementById('add-to-cart-btn');

      if (detailProduct.stock > 0) {
        dot.className = 'stock-dot in';
        text.textContent = `In Stock (${detailProduct.stock} units available)`;
        if (actionBtn) {
          actionBtn.disabled = false;
          actionBtn.textContent = 'Add to Cart';
        }
      } else {
        dot.className = 'stock-dot out';
        text.textContent = 'Out of Stock';
        if (actionBtn) {
          actionBtn.disabled = true;
          actionBtn.textContent = 'Unavailable';
        }
      }
    } else {
      showNotification('Product details could not be loaded.', 'error');
    }
  } catch (err) {
    console.error('Details fetch error:', err);
  }
}

/* ========================================================
   4. ADD TO CART ROUTINES
   ======================================================== */

/**
 * Triggered from listing grid pages directly without redirect.
 */
async function quickAddToCart(productId) {
  if (!isAuthenticated()) {
    showNotification('Please login to add items to your cart.', 'error');
    setTimeout(() => {
      window.location.href = `/login.html?redirect=products.html`;
    }, 1000);
    return;
  }

  await executeAddToCart(productId, 1);
}

/**
 * Fires the API request to insert/increment cart items database table.
 */
async function executeAddToCart(productId, quantity) {
  try {
    const res = await fetchWithAuth('/api/cart/add', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity })
    });

    if (res.success) {
      showNotification(res.message || 'Product added to cart!', 'success');
      // Refresh global badge count
      updateCartBadgeCount();
    } else {
      showNotification(res.message || 'Failed to add item.', 'error');
    }
  } catch (err) {
    console.error('Cart add api error:', err);
    showNotification('Could not connect to cart service.', 'error');
  }
}

/* ========================================================
   5. DECORATION HELPERS
   ======================================================== */
function getCategoryEmoji(categoryName) {
  switch (categoryName) {
    case 'Electronics': return '💻';
    case 'Fashion': return '👕';
    case 'Books': return '📚';
    case 'Home Decor': return '🏺';
    default: return '🛍️';
  }
}

function getProductEmoji(categoryName) {
  switch (categoryName) {
    case 'Electronics': return '<span style="font-size: 4rem;">📱</span>';
    case 'Fashion': return '<span style="font-size: 4rem;">👟</span>';
    case 'Books': return '<span style="font-size: 4rem;">📖</span>';
    case 'Home Decor': return '<span style="font-size: 4rem;">💡</span>';
    default: return '<span style="font-size: 4rem;">📦</span>';
  }
}
