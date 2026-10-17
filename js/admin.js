/* =====================================================
   ANANTMART ADMIN — SUPABASE VERSION
   Requires: Supabase CDN + js/supabase.js
===================================================== */

const db = window.supabaseClient;

let adminVerified = false;
let adminCheckPromise = null;

// ---------- HELPERS ----------

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

// ---------- ADMIN AUTHORIZATION ----------

async function verifyAdmin() {
  if (adminVerified) return true;
  if (adminCheckPromise) return adminCheckPromise;

  adminCheckPromise = (async () => {
    if (!db) {
      throw new Error(
        "Supabase client nahi mila. Script loading order check karo."
      );
    }

    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData.session;

    if (!session) {
      alert("Admin panel ke liye login karna zaroori hai.");
      window.location.href = "./login.html";
      return false;
    }

    const { data: isAdmin, error } = await db.rpc("is_admin");

    if (error) throw error;

    if (isAdmin !== true) {
      alert("Access denied: Sirf authorized admin access kar sakta hai.");
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

// ---------- LOAD PRODUCTS ----------

async function loadProducts() {
  const container = byId("adminProducts");
  if (!container) return;

  try {
    if (!(await verifyAdmin())) return;

    const { data: products, error } = await db
      .from("products")
      .select(
        "id, name, price, category, stock, image_url, is_active"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    container.replaceChildren();

    if (!products || products.length === 0) {
      container.textContent = "Abhi koi product nahi hai.";
      return;
    }

    products.forEach(product => {
      const card = document.createElement("div");
      card.className = "admin-product";

      const img = document.createElement("img");
      img.src = product.image_url || "https://placehold.co/150";
      img.alt = product.name || "Product";
      img.loading = "lazy";
      img.onerror = () => {
        img.onerror = null;
        img.src = "https://placehold.co/150";
      };

      const title = document.createElement("h3");
      title.textContent = product.name;

      const price = document.createElement("p");
      price.textContent = formatINR(product.price);

      const category = document.createElement("p");
      category.textContent = "Category: " + product.category;

      const stock = document.createElement("p");
      stock.textContent = "Stock: " + product.stock;

      const status = document.createElement("p");
      status.textContent = product.is_active ? "Active" : "Inactive";

      const actions = document.createElement("div");
      actions.className = "action-btns";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.className = "edit-btn";
      edit.addEventListener("click", () => editProduct(product.id));

      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Delete";
      del.className = "delete-btn";
      del.addEventListener("click", () => deleteProduct(product.id));

      actions.append(edit, del);
      card.append(img, title, price, category, stock, status, actions);
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Products load error:", error);
    container.textContent = "Products load nahi hue. Console check karo.";
  }
}

// ---------- ADD PRODUCT ----------

async function addProduct() {
  try {
    if (!(await verifyAdmin())) return;

    const name = byId("productName")?.value.trim();
    const priceText = byId("productPrice")?.value;
    const category = byId("productCategory")?.value;
    const stockText = byId("productStock")?.value;
    const imageUrl = byId("productImage")?.value.trim();

    const price = Number(priceText);
    const stock = Number(stockText || 0);

    if (!name || priceText === "" || !category) {
      return showError("Product name, price aur category bharo.");
    }

    if (!Number.isFinite(price) || price < 0) {
      return showError("Valid product price daalo.");
    }

    if (!Number.isInteger(stock) || stock < 0) {
      return showError("Stock zero ya positive whole number hona chahiye.");
    }

    if (imageUrl) {
      try {
        const parsed = new URL(imageUrl);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          throw new Error("Invalid image URL");
        }
      } catch {
        return showError("Valid HTTP/HTTPS image URL daalo.");
      }
    }

    const { error } = await db.from("products").insert({
      name,
      price,
      category,
      stock,
      image_url: imageUrl || null,
      is_active: true
    });

    if (error) throw error;

    alert("Product successfully add ho gaya!");

    ["productName", "productPrice", "productStock", "productImage"]
      .forEach(id => {
        if (byId(id)) byId(id).value = "";
      });

    await loadProducts();
    await loadAdminStatsAndOrders();
  } catch (error) {
    console.error("Add product error:", error);
    showError("Product add nahi hua. RLS policy aur console error check karo.");
  }
}

// ---------- EDIT PRODUCT ----------

async function editProduct(id) {
  try {
    if (!(await verifyAdmin())) return;

    const { data: product, error: fetchError } = await db
      .from("products")
      .select("id, name, price, category, stock, image_url, is_active")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    const nameInput = prompt("Product name:", product.name);
    if (nameInput === null) return;

    const priceInput = prompt("Product price:", String(product.price));
    if (priceInput === null) return;

    const stockInput = prompt("Product stock:", String(product.stock));
    if (stockInput === null) return;

    const imageInput = prompt(
      "Image URL (blank = no image):",
      product.image_url || ""
    );
    if (imageInput === null) return;

    const name = nameInput.trim();
    const price = Number(priceInput);
    const stock = Number(stockInput);
    const imageUrl = imageInput.trim();

    if (!name || priceInput.trim() === "" ||
        !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(stock) || stock < 0) {
      return showError("Name, price ya stock ki value valid nahi hai.");
    }

    if (imageUrl) {
      try {
        const parsed = new URL(imageUrl);
        if (!["https:", "http:"].includes(parsed.protocol)) {
          throw new Error("Invalid URL");
        }
      } catch {
        return showError("Valid HTTP/HTTPS image URL daalo.");
      }
    }

    const { error } = await db
      .from("products")
      .update({
        name,
        price,
        stock,
        image_url: imageUrl || null
      })
      .eq("id", id);

    if (error) throw error;

    alert("Product update ho gaya!");
    await loadProducts();
  } catch (error) {
    console.error("Edit product error:", error);
    showError("Product update nahi hua. RLS permissions check karo.");
  }
}

// ---------- DELETE PRODUCT ----------

async function deleteProduct(id) {
  if (!confirm("Kya tum is product ko permanently delete karna chahte ho?")) {
    return;
  }

  try {
    if (!(await verifyAdmin())) return;

    const { error } = await db
      .from("products")
      .delete()
      .eq("id", id);

    if (error) throw error;

    alert("Product delete ho gaya!");
    await loadProducts();
    await loadAdminStatsAndOrders();
  } catch (error) {
    console.error("Delete product error:", error);
    showError("Product delete nahi hua. RLS aur order references check karo.");
  }
}

// ---------- DASHBOARD STATS & ORDERS ----------

async function loadAdminStatsAndOrders() {
  const tableBody = byId("adminOrderTableBody");

  try {
    if (!(await verifyAdmin())) return;

    const [ordersResult, usersResult] = await Promise.all([
      db.from("orders")
        .select("id, user_id, total_amount, status, shipping_address, created_at")
        .order("created_at", { ascending: false }),

      db.from("profiles")
        .select("id", { count: "exact", head: true })
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (usersResult.error) throw usersResult.error;

    const orders = ordersResult.data || [];

    if (byId("ordersWidget")) {
      byId("ordersWidget").textContent = String(orders.length);
    }

    if (byId("usersWidget")) {
      byId("usersWidget").textContent = String(usersResult.count || 0);
    }

    // Sirf paid/completed/delivered orders ko revenue maana gaya hai.
    // Apne actual payment/status workflow ke hisaab se statuses adjust karo.
    const revenueStatuses = new Set(["paid", "completed", "delivered"]);

    const revenue = orders.reduce((sum, order) => {
      const status = String(order.status || "").toLowerCase();
      return revenueStatuses.has(status)
        ? sum + Number(order.total_amount || 0)
        : sum;
    }, 0);

    if (byId("revenueWidget")) {
      byId("revenueWidget").textContent = formatINR(revenue);
    }

    if (!tableBody) return;

    tableBody.replaceChildren();

    if (orders.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = "Abhi koi order nahi hai.";
      row.appendChild(cell);
      tableBody.appendChild(row);
      return;
    }

    const orderIds = orders.map(order => order.id);

    const { data: items, error: itemsError } = await db
      .from("order_items")
      .select("order_id, product_name, quantity")
      .in("order_id", orderIds);

    if (itemsError) throw itemsError;

    const itemsByOrder = {};

    (items || []).forEach(item => {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }
      itemsByOrder[item.order_id].push(item);
    });

    orders.forEach(order => {
      const row = document.createElement("tr");
      const address = order.shipping_address || {};
      const orderItems = itemsByOrder[order.id] || [];

      const itemsText = orderItems.length
        ? orderItems.map(item =>
            `${item.product_name} (${item.quantity})`
          ).join(", ")
        : "No item details";

      const contact =
        address.email ||
        address.phone ||
        address.full_name ||
        address.name ||
        order.user_id ||
        "N/A";

      const date = order.created_at
        ? new Date(order.created_at).toLocaleString("en-IN")
        : "N/A";

      addCell(row, order.id);
      addCell(row, contact);
      addCell(row, itemsText);
      addCell(row, formatINR(order.total_amount));
      addCell(row, date);
      addCell(row, order.status || "Pending");

      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    if (tableBody) {
      tableBody.replaceChildren();
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = "Dashboard data load nahi hua. Console check karo.";
      row.appendChild(cell);
      tableBody.appendChild(row);
    }
  }
}

// ---------- START ----------

document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (!(await verifyAdmin())) return;

    await Promise.all([
      loadProducts(),
      loadAdminStatsAndOrders()
    ]);
  } catch (error) {
    console.error("Admin initialization failed:", error);
    alert("Admin panel initialize nahi hua. Login aur Supabase settings check karo.");
  }
});