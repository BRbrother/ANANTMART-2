/* =====================================================
   GRAM MART ADMIN — SUPABASE
   Requires:
   1. Supabase CDN
   2. js/supabase.js
   3. This file: js/admin.js
===================================================== */

const db = window.supabaseClient;

let adminVerified = false;
let adminCheckPromise = null;
let allAdminOrders = [];

// ---------- COMMON HELPERS ----------

function byId(id) {
  return document.getElementById(id);
}

function showError(message) {
  console.error(message);
  alert(message);
}

function formatINR(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  });
}

function addCell(row, value) {
  const td = document.createElement("td");
  td.textContent = String(value ?? "N/A");
  row.appendChild(td);
  return td;
}

function statusClass(status) {
  const value = String(status || "pending").toLowerCase();

  if (value === "delivered") return "status-delivered";
  if (value === "cancelled") return "status-cancelled";
  if (value === "pending") return "status-pending";
  if (value === "shipped") return "status-shipped";

  return "";
}

function validateImageUrl(value) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// ---------- ADMIN AUTHORIZATION ----------

async function verifyAdmin() {
  if (adminVerified) return true;

  if (adminCheckPromise) {
    return adminCheckPromise;
  }

  adminCheckPromise = (async () => {
    if (!db) {
      throw new Error(
        "Supabase client nahi mila. Script loading order check karo."
      );
    }

    const {
      data: sessionData,
      error: sessionError
    } = await db.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!sessionData.session) {
      alert("Admin panel ke liye login karna zaroori hai.");
      window.location.href = "./login.html";
      return false;
    }

    const {
      data: isAdmin,
      error
    } = await db.rpc("is_admin");

    if (error) {
      throw error;
    }

    if (isAdmin !== true) {
      alert(
        "Access denied: Sirf authorized admin access kar sakta hai."
      );

      window.location.href = "./index.html";
      return false;
    }

    adminVerified = true;
    return true;
  })();

  try {
    return await adminCheckPromise;
  } finally {
    adminCheckPromise = null;
  }
}

// ---------- ADD PRODUCT FORM ----------
// Product editing now happens on edit-product.html.
// This form is only for adding a new product.

function resetProductForm() {
  byId("productForm")?.reset();

  const heading = byId("productFormHeading");

  if (heading) {
    heading.textContent = "Add Grocery Product";
  }

  const submitButton = byId("productSubmitBtn");

  if (submitButton) {
    submitButton.textContent = "＋ Add Product";
  }

  const cancelButton = byId("cancelEditBtn");

  if (cancelButton) {
    cancelButton.hidden = true;
  }
}

async function handleProductSubmit(event) {
  event.preventDefault();

  try {
    if (!(await verifyAdmin())) return;

    const name = byId("productName")?.value.trim() || "";
    const priceText = byId("productPrice")?.value ?? "";
    const category = byId("productCategory")?.value || "";
    const stockText = byId("productStock")?.value ?? "";
    const imageUrl = byId("productImage")?.value.trim() || "";

    const price = Number(priceText);
    const stock = Number(stockText);

    if (
      !name ||
      priceText === "" ||
      !category ||
      stockText === ""
    ) {
      return showError(
        "Product name, price, category aur stock bharo."
      );
    }

    if (!Number.isFinite(price) || price < 0) {
      return showError("Valid product price daalo.");
    }

    if (!Number.isInteger(stock) || stock < 0) {
      return showError(
        "Stock zero ya positive whole number hona chahiye."
      );
    }

    if (!validateImageUrl(imageUrl)) {
      return showError(
        "Valid HTTP/HTTPS image URL daalo."
      );
    }

    const productData = {
      name,
      price,
      category,
      stock,
      image_url: imageUrl || null,
      is_active: true
    };

    const {
      error
    } = await db
      .from("products")
      .insert(productData);

    if (error) {
      throw error;
    }

    alert("Product add ho gaya!");

    resetProductForm();

    await Promise.all([
      loadProducts(),
      loadAdminStatsAndOrders()
    ]);

  } catch (error) {
    console.error("Product save error:", error);

    showError(
      "Product save nahi hua. Supabase RLS permissions aur console error check karo."
    );
  }
}

// ---------- LOAD PRODUCTS ----------

async function loadProducts() {
  const container = byId("adminProducts");

  if (!container) return;

  try {
    if (!(await verifyAdmin())) return;

    const {
      data: products,
      error
    } = await db
      .from("products")
      .select(
        "id, name, price, category, stock, image_url, is_active"
      )
      .order("created_at", {
        ascending: false
      });

    if (error) {
      throw error;
    }

    container.replaceChildren();

    const productList = products || [];

    const activeProducts = productList.filter(
      product => product.is_active === true
    );

    const lowStockProducts = activeProducts.filter(
      product => Number(product.stock || 0) <= 5
    );

    if (byId("productsWidget")) {
      byId("productsWidget").textContent =
        String(activeProducts.length);
    }

    if (byId("lowStockWidget")) {
      byId("lowStockWidget").textContent =
        String(lowStockProducts.length);
    }

    if (productList.length === 0) {
      container.textContent = "Abhi koi product nahi hai.";
      return;
    }

    productList.forEach(product => {
      const card = document.createElement("article");
      card.className = "admin-product";

      // Product image
      const img = document.createElement("img");

      img.src =
        product.image_url ||
        "https://placehold.co/300x200?text=GRAM+MART";

      img.alt = product.name || "Grocery product";
      img.loading = "lazy";

      img.onerror = () => {
        img.onerror = null;
        img.src =
          "https://placehold.co/300x200?text=GRAM+MART";
      };

      // Product name
      const title = document.createElement("h3");
      title.textContent =
        product.name || "Unnamed product";

      // Price
      const price = document.createElement("p");
      price.textContent = formatINR(product.price);

      // Category
      const category = document.createElement("p");

      category.textContent =
        "Category: " + (product.category || "Other");

      // Stock
      const stock = document.createElement("p");

      stock.textContent =
        "Stock: " + Number(product.stock || 0);

      // Status
      const status = document.createElement("p");

      status.textContent = product.is_active
        ? "● Active"
        : "○ Inactive";

      // Action buttons
      const actions = document.createElement("div");
      actions.className = "action-btns";

      // EDIT BUTTON — OPENS SEPARATE EDIT PAGE
      const edit = document.createElement("button");

      edit.type = "button";
      edit.className = "btn btn-secondary";
      edit.textContent = "Edit";

      edit.addEventListener("click", () => {
        const productId = encodeURIComponent(product.id);

        window.location.href =
          "./edit-product.html?id=" + productId;
      });

      // DELETE BUTTON
      const del = document.createElement("button");

      del.type = "button";
      del.className = "btn btn-danger";
      del.textContent = "Delete";

      del.addEventListener("click", () => {
        deleteProduct(product.id);
      });

      actions.append(edit, del);

      card.append(
        img,
        title,
        price,
        category,
        stock,
        status,
        actions
      );

      container.appendChild(card);
    });

  } catch (error) {
    console.error("Products load error:", error);

    container.textContent =
      "Products load nahi hue. Console check karo.";
  }
}

// ---------- DELETE PRODUCT ----------

async function deleteProduct(id) {
  const confirmed = confirm(
    "Kya tum is product ko permanently delete karna chahte ho?"
  );

  if (!confirmed) return;

  try {
    if (!(await verifyAdmin())) return;

    const {
      error
    } = await db
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    alert("Product delete ho gaya!");

    await Promise.all([
      loadProducts(),
      loadAdminStatsAndOrders()
    ]);

  } catch (error) {
    console.error("Delete product error:", error);

    showError(
      "Product delete nahi hua. RLS permissions ya order references check karo."
    );
  }
}

// ---------- RENDER ADMIN ORDERS ----------

function renderAdminOrders() {
  const tableBody = byId("adminOrderTableBody");

  if (!tableBody) return;

  const search = (
    byId("orderSearch")?.value || ""
  ).trim().toLowerCase();

  const statusFilter = (
    byId("orderStatusFilter")?.value || ""
  ).toLowerCase();

  const filteredOrders = allAdminOrders.filter(order => {
    const status = String(
      order.status || "pending"
    ).toLowerCase();

    if (statusFilter && status !== statusFilter) {
      return false;
    }

    const address = order.shipping_address || {};

    const contact = [
      address.email,
      address.phone,
      address.full_name,
      address.name,
      order.user_id
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const items = (order.items || [])
      .map(item =>
        `${item.product_name || ""} ${item.quantity || ""}`
      )
      .join(" ")
      .toLowerCase();

    const searchable = [
      order.id,
      contact,
      items,
      order.status,
      order.total_amount
    ]
      .join(" ")
      .toLowerCase();

    return !search || searchable.includes(search);
  });

  tableBody.replaceChildren();

  if (filteredOrders.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 6;
    cell.textContent =
      "Is filter ke liye koi order nahi mila.";

    row.appendChild(cell);
    tableBody.appendChild(row);

    return;
  }

  filteredOrders.forEach(order => {
    const row = document.createElement("tr");

    const address = order.shipping_address || {};
    const items = order.items || [];

    const shortId = String(order.id || "").slice(0, 8);

    const itemsText = items.length
      ? items
          .map(item =>
            `${item.product_name || "Product"} (${item.quantity})`
          )
          .join(", ")
      : "No item details";

    const contact = [
      address.full_name || address.name,
      address.phone,
      address.email
    ]
      .filter(Boolean)
      .join(" · ") || order.user_id || "N/A";

    const date = order.created_at
      ? new Date(order.created_at).toLocaleString("en-IN")
      : "N/A";

    addCell(row, shortId);
    addCell(row, contact);
    addCell(row, itemsText);
    addCell(row, formatINR(order.total_amount));
    addCell(row, date);

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");

    const status = String(
      order.status || "pending"
    ).toLowerCase();

    badge.className =
      "status-badge " + statusClass(status);

    badge.textContent =
      status.charAt(0).toUpperCase() + status.slice(1);

    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    tableBody.appendChild(row);
  });
}

// ---------- DASHBOARD STATS & ORDERS ----------

async function loadAdminStatsAndOrders() {
  const tableBody = byId("adminOrderTableBody");

  try {
    if (!(await verifyAdmin())) return;

    const [
      ordersResult,
      usersResult
    ] = await Promise.all([
      db
        .from("orders")
        .select(
          "id, user_id, total_amount, status, shipping_address, created_at"
        )
        .order("created_at", {
          ascending: false
        }),

      db
        .from("profiles")
        .select("id", {
          count: "exact",
          head: true
        })
    ]);

    if (ordersResult.error) {
      throw ordersResult.error;
    }

    if (usersResult.error) {
      throw usersResult.error;
    }

    const orders = ordersResult.data || [];

    const orderIds = orders.map(order => order.id);

    let items = [];

    if (orderIds.length > 0) {
      const {
        data: itemRows,
        error: itemsError
      } = await db
        .from("order_items")
        .select(
          "order_id, product_name, quantity"
        )
        .in("order_id", orderIds);

      if (itemsError) {
        throw itemsError;
      }

      items = itemRows || [];
    }

    const itemsByOrder = {};

    items.forEach(item => {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }

      itemsByOrder[item.order_id].push(item);
    });

    allAdminOrders = orders.map(order => ({
      ...order,
      items: itemsByOrder[order.id] || []
    }));

    const countStatus = status => {
      return orders.filter(order =>
        String(order.status || "").toLowerCase() === status
      ).length;
    };

    const deliveredOrders = countStatus("delivered");
    const pendingOrders = countStatus("pending");
    const cancelledOrders = countStatus("cancelled");

    // Delivered order value, not verified payment revenue.
    const deliveredValue = orders.reduce((sum, order) => {
      if (
        String(order.status || "").toLowerCase() === "delivered"
      ) {
        return sum + Number(order.total_amount || 0);
      }

      return sum;
    }, 0);

    if (byId("ordersWidget")) {
      byId("ordersWidget").textContent =
        String(orders.length);
    }

    if (byId("usersWidget")) {
      byId("usersWidget").textContent =
        String(usersResult.count || 0);
    }

    if (byId("pendingOrdersWidget")) {
      byId("pendingOrdersWidget").textContent =
        String(pendingOrders);
    }

    if (byId("deliveredOrdersWidget")) {
      byId("deliveredOrdersWidget").textContent =
        String(deliveredOrders);
    }

    if (byId("cancelledOrdersWidget")) {
      byId("cancelledOrdersWidget").textContent =
        String(cancelledOrders);
    }

    if (byId("revenueWidget")) {
      byId("revenueWidget").textContent =
        formatINR(deliveredValue);
    }

    renderAdminOrders();

  } catch (error) {
    console.error("Admin dashboard error:", error);

    if (tableBody) {
      tableBody.replaceChildren();

      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 6;
      cell.textContent =
        "Dashboard data load nahi hua. Console check karo.";

      row.appendChild(cell);
      tableBody.appendChild(row);
    }

    showError(
      "Dashboard load nahi hua. Browser console aur Supabase RLS policies check karo."
    );
  }
}

// ---------- REFRESH ADMIN ----------

async function refreshAdmin() {
  await Promise.all([
    loadProducts(),
    loadAdminStatsAndOrders()
  ]);
}

// ---------- START ADMIN ----------

document.addEventListener("DOMContentLoaded", async () => {
  // Add Product form, if present on this page.
  byId("productForm")?.addEventListener(
    "submit",
    handleProductSubmit
  );

  byId("cancelEditBtn")?.addEventListener(
    "click",
    resetProductForm
  );

  // Order search and status filters.
  byId("orderSearch")?.addEventListener(
    "input",
    renderAdminOrders
  );

  byId("orderStatusFilter")?.addEventListener(
    "change",
    renderAdminOrders
  );

  try {
    if (!(await verifyAdmin())) return;

    await refreshAdmin();

  } catch (error) {
    console.error(
      "Admin initialization failed:",
      error
    );

    alert(
      "Admin panel initialize nahi hua. Login aur Supabase settings check karo."
    );
  }
});