# Walkthrough: ShopSphere E-Commerce Project

We have successfully built the complete, fully working, and beginner-friendly **ShopSphere** E-Commerce web application inside your workspace. This application is specifically tailored for a DBMS college project, combining visual appeal with clean, highly explainable code.

---

## 📂 Summary of Components Created

### 💾 1. Database Layer (`database/`)
* **[shopsphere.sql](file:///c:/Users/gsksa/Desktop/DBMS/database/shopsphere.sql)**: A clean SQL dump defining 7 normalized relational tables (`categories`, `users`, `products`, `cart`, `cart_items`, `orders`, `order_items`) linked by foreign key cascades. It includes preloaded seed categories, products, a customer account, and an admin account.

### ⚙️ 2. Backend Layer (`backend/`)
* **[server.js](file:///c:/Users/gsksa/Desktop/DBMS/backend/server.js)**: Entry script that launches Express, triggers self-healing MySQL pool connections, wires API routes, hosts static frontend files on port 5000, and provides global error controllers.
* **[config/db.js](file:///c:/Users/gsksa/Desktop/DBMS/backend/config/db.js)**: Implements database helper routines and preloads table schemas dynamically on start if missing.
* **[middleware/authMiddleware.js](file:///c:/Users/gsksa/Desktop/DBMS/backend/middleware/authMiddleware.js)**: Holds JWT session interceptor guards (`protect`) and admin privilege validators (`adminOnly`).
* **[controllers/](file:///c:/Users/gsksa/Desktop/DBMS/backend/controllers/) & [routes/](file:///c:/Users/gsksa/Desktop/DBMS/backend/routes/)**:
  * **Auth**: Hashes passwords via `bcryptjs`, issues JWT tokens, registers carts, and outputs account summaries.
  * **Products**: Lists products with active sorting (price) and filtering (category ID and keywords), lists categories, and supports admin CRUD.
  * **Cart**: Updates cart rows and manages stock verification in real-time.
  * **Orders**: Handles checkouts atomically using **SQL Transactions** (beginning, committing, rolling back on error).

### 🎨 3. Frontend Layer (`frontend/`)
* **[css/style.css](file:///c:/Users/gsksa/Desktop/DBMS/frontend/css/style.css)**: Global stylesheet utilizing premium HSL design variables (elegant Indigo and Pink/Coral accent), sticky glassmorphism headers, statistics cards grids, modal dialogues, floating animations, and mobile-friendly grids.
* **HTML Pages**:
  * **[index.html](file:///c:/Users/gsksa/Desktop/DBMS/frontend/index.html)**: Main landing showcase with glassmorphic layouts and featured collections.
  * **[products.html](file:///c:/Users/gsksa/Desktop/DBMS/frontend/products.html)**: Split catalog browser with sidebar filters and sort selects.
  * **[product-details.html](file:///c:/Users/gsksa/Desktop/DBMS/frontend/product-details.html)**: Details display page with quantity add limits.
  * **[cart.html](file:///c:/Users/gsksa/Desktop/DBMS/frontend/cart.html)**: Displays tabular list of products in the cart with dynamic summaries.
  * **[checkout.html](file:///c:/Users/gsksa/Desktop/DBMS/frontend/checkout.html)**: Billing coordinates forms and purchase success dashboard receipt.
  * **[orders.html](file:///c:/Users/gsksa/Desktop/DBMS/frontend/orders.html)**: Historical order sheets (with status badges and Receipt Modals).
  * **[login.html](file:///c:/Users/gsksa/Desktop/DBMS/frontend/login.html) & [register.html](file:///c:/Users/gsksa/Desktop/DBMS/frontend/register.html)**: Access portals with form checkers.
  * **[admin.html](file:///c:/Users/gsksa/Desktop/DBMS/frontend/admin.html)**: Multi-tab workbench containing metrics widgets, CRUD managers, and order shipment selects.
* **[js/](file:///c:/Users/gsksa/Desktop/DBMS/frontend/js/) (Vanilla Javascript Module scripts)**:
  * **`main.js`**: Session managers, Dynamic navigation generators, notifications.
  * **`auth.js`**: AJAX form submissions and login token keepers.
  * **`products.js`**: Dynamic catalog listings, sorting, and detail page controllers.
  * **`cart.js`**: Cart rows editor, subtotal calculations.
  * **`checkout.js`**: Customer billing checks and success screen builders.
  * **`orders.js`**: Purchase histories loader and modal receipts triggers.
  * **`admin.js`**: Dashboard tabs controller, Modal creation CRUD, and status adjusters.

---

## 🔑 Summary of Preloaded Accounts (For Demonstration)

To make showcasing the project simple, we have preloaded two accounts:

| Role | Email | Password | Primary Viva Features to Demo |
| :--- | :--- | :--- | :--- |
| **Normal User** | `user@shopsphere.com` | `user123` | Browsing, search filters, adding items, quantity modifiers, secure checkout, order history logs, and line-item modal popup receipt. |
| **Admin User** | `admin@shopsphere.com` | `admin123` | Analytics cards (Products, Orders, Revenue), Product CRUD (Add/Edit modals), User Directory directory view, and Order Shipment dropdown updates. |

---

## 🎓 Viva Quick-Sheet (Common DBMS Questions & Answers)

During your evaluation, the examiner will likely ask how the database and backend interact. Here is your cheat sheet:

> [!TIP]
> **Q: How are you defending against SQL Injection attacks?**
> * **Answer**: We avoid standard string concatenations when building queries (e.g. `WHERE email = '` + email + `'`). Instead, inside `backend/config/db.js`, we enforce **parameterized queries** using query binders:
>   `db.query('SELECT * FROM users WHERE email = ?', [email]);`
>   The MySQL database engine treats inputs inside `[ ]` strictly as plain text (variables) and never compiles them, neutralizing SQL injection attempts.

> [!TIP]
> **Q: How does your checkout implement ACID properties?**
> * **Answer**: Inside `backend/controllers/orderController.js`, checkouts use **explicit MySQL transactions**.
>   1. We begin the transaction: `await connection.beginTransaction();`
>   2. We verify if catalog stock levels are sufficient. If a stock conflict exists, we immediately trigger `await connection.rollback();` to cancel all modifications.
>   3. If everything is valid, we write to `orders`, write items to `order_items`, decrement stock levels, clear the cart, and execute `await connection.commit();`. This ensures **Atomicity** (either the whole checkout succeeds or nothing changes) and **Consistency** (stock levels remain valid).

> [!TIP]
> **Q: What is database connection pooling?**
> * **Answer**: Opening and closing a separate MySQL database connection for every single HTTP request is slow and memory-intensive. In `backend/config/db.js`, we use `mysql.createPool()` to pre-establish 10 active connections. When a customer executes an action, the server borrows an existing connection from the pool, runs the query, and returns it immediately.
