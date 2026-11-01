(() => {
  "use strict";

  const db = window.supabaseClient;

  const $ = (id) => document.getElementById(id);

  let products = [];
  let authorized = false;

  function message(text, type = "info") {
    const el = $("message");
    if (!el) return;

    el.textContent = text;
    el.style.color =
      type === "error" ? "#dc2626" :
      type === "success" ? "#15803d" : "#64748b";
  }

  function formatINR(value) {
    return Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    });
  }

  async function verifyAccess() {
    if (!db) {
      throw new Error("Supabase client load nahi hua. js/supabase.js check karo.");
    }

    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData.session) {
      window.location.href = "./login.html";
      return false;
    }

    const { data: isAdmin, error: adminError } =
      await db.rpc("is_admin");

    if (adminError) throw adminError;

    const { data: isInventoryAdmin, error: inventoryError } =
      await db.rpc("is_inventory_admin");

    if (inventoryError) throw inventoryError;

    if (isAdmin !== true && isInventoryAdmin !== true) {
      alert("Access denied: Inventory permission required.");
      window.location.href = "./index.html";
      return false;
    }

    authorized = true;
    return true;
  }

  async function loadProducts() {
    if (!authorized) return;

    message("Loading products...");

    const { data, error } = await db
      .from("products")
      .select("id, name, price, category, stock, image_url, is_active")
      .order("name", { ascending: true })
      .range(0, 999);

    if (error) throw error;

    products = data || [];

    updateStats();
    updateCategories();
    renderProducts();

    message(`${products.length} products loaded.`, "success");
  }

  function updateStats() {
    const total = products.length;

    const inStock = products.filter(
      p => Number(p.stock || 0) > 5
    ).length;

    const lowStock = products.filter(
      p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 5
    ).length;

    const outStock = products.filter(
      p => Number(p.stock || 0) === 0
    ).length;

    $("totalProducts").textContent = total;
    $("inStock").textContent = inStock;
    $("lowStock").textContent = lowStock;
    $("outStock").textContent = outStock;
  }

  function updateCategories() {
    const select = $("categoryFilter");
    const selected = select.value;

    const categories = [
      ...new Set(
        products
          .map(p => String(p.category || "").trim())
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b));

    select.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All Categories";
    select.appendChild(allOption);

    categories.forEach(category => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });

    if (categories.includes(selected)) {
      select.value = selected;
    }
  }

  function createCell(text) {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  function renderProducts() {
    const tbody = $("productTable");
    tbody.replaceChildren();

    const search = $("searchInput").value.trim().toLowerCase();
    const category = $("categoryFilter").value;

    const filtered = products.filter(product => {
      const matchesSearch =
        String(product.name || "").toLowerCase().includes(search);

      const matchesCategory =
        !category || product.category === category;

      return matchesSearch && matchesCategory;
    });

    if (!filtered.length) {
      const row = document.createElement("tr");
      const cell = createCell("No products found.");
      cell.colSpan = 6;
      cell.className = "empty";
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    filtered.forEach(product => {
      const row = document.createElement("tr");

      // Product image and name
      const productCell = document.createElement("td");
      const productBox = document.createElement("div");
      productBox.className = "product-cell";

      const img = document.createElement("img");
      img.alt = product.name || "Product";
      img.loading = "lazy";
      img.src = product.image_url || "https://placehold.co/100x100?text=GM";

      img.onerror = () => {
        img.onerror = null;
        img.src = "https://placehold.co/100x100?text=GM";
      };

      const name = document.createElement("div");
      name.className = "product-name";
      name.textContent = product.name || "Unnamed Product";

      productBox.append(img, name);
      productCell.appendChild(productBox);
      row.appendChild(productCell);

      row.appendChild(createCell(product.category || "Other"));
      row.appendChild(createCell(formatINR(product.price)));

      // Stock control
      const stockCell = document.createElement("td");
      const stockBox = document.createElement("div");
      stockBox.className = "stock-control";

      const stockInput = document.createElement("input");
      stockInput.type = "number";
      stockInput.min = "0";
      stockInput.step = "1";
      stockInput.value = Number(product.stock || 0);
      stockInput.setAttribute("aria-label", "Stock quantity");

      const saveStock = document.createElement("button");
      saveStock.type = "button";
      saveStock.className = "btn btn-blue";
      saveStock.textContent = "Save";

      saveStock.addEventListener("click", async () => {
        await updateStock(product.id, stockInput, saveStock);
      });

      stockBox.append(stockInput, saveStock);
      stockCell.appendChild(stockBox);
      row.appendChild(stockCell);

      // Active status
      const statusCell = document.createElement("td");
      const badge = document.createElement("span");

      badge.className = product.is_active
        ? "status status-active"
        : "status status-inactive";

      badge.textContent = product.is_active ? "Active" : "Inactive";

      statusCell.appendChild(badge);
      row.appendChild(statusCell);

      // Actions
      const actionCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "actions";

      const editBtn = document.createElement("a");
      editBtn.className = "btn btn-light";
      editBtn.textContent = "Edit";
      editBtn.href =
        "./edit-product.html?id=" + encodeURIComponent(product.id);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-danger";
      deleteBtn.textContent = "Delete";

      deleteBtn.addEventListener("click", async () => {
        await deleteProduct(product.id, deleteBtn);
      });

      actions.append(editBtn, deleteBtn);
      actionCell.appendChild(actions);
      row.appendChild(actionCell);

      tbody.appendChild(row);
    });
  }

  async function updateStock(id, input, button) {
    if (!authorized) return;

    const stockText = input.value.trim();
    const stock = Number(stockText);

    if (
      stockText === "" ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      message("Stock zero ya positive whole number hona chahiye.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    try {
      const { data, error } = await db
        .from("products")
        .update({ stock })
        .eq("id", id)
        .select("id, stock")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error("Stock update nahi hua. Permission ya product check karo.");
      }

      const product = products.find(p => String(p.id) === String(id));

      if (product) {
        product.stock = data.stock;
      }

      updateStats();
      message("Stock successfully update ho gaya.", "success");

    } catch (error) {
      console.error("Stock update error:", error);
      message(error.message || "Stock update failed.", "error");

    } finally {
      button.disabled = false;
      button.textContent = "Save";
    }
  }

  async function deleteProduct(id, button) {
    if (!authorized) return;

    const confirmed = window.confirm(
      "Kya tum is product ko permanently delete karna chahte ho?"
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Deleting...";

    try {
      const { data, error } = await db
        .from("products")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Product delete nahi hua. Permission check karo.");
      }

      products = products.filter(
        product => String(product.id) !== String(id)
      );

      updateStats();
      updateCategories();
      renderProducts();

      message("Product successfully delete ho gaya.", "success");

    } catch (error) {
      console.error("Product delete error:", error);
      message(error.message || "Product delete failed.", "error");

      button.disabled = false;
      button.textContent = "Delete";
    }
  }

  async function logout() {
    if (!db) return;

    const { error } = await db.auth.signOut();

    if (error) {
      message("Logout nahi hua: " + error.message, "error");
      return;
    }

    window.location.href = "./login.html";
  }

  async function init() {
    try {
      $("productTable").innerHTML =
        '<tr><td colspan="6" class="empty">Checking access...</td></tr>';

      const allowed = await verifyAccess();

      if (!allowed) return;

      $("searchInput").addEventListener("input", renderProducts);
      $("categoryFilter").addEventListener("change", renderProducts);

      $("refreshBtn").addEventListener("click", async () => {
        $("refreshBtn").disabled = true;

        try {
          await loadProducts();
        } catch (error) {
          console.error(error);
          message(error.message || "Products load nahi hue.", "error");
        } finally {
          $("refreshBtn").disabled = false;
        }
      });

      $("logoutBtn").addEventListener("click", logout);

      await loadProducts();

    } catch (error) {
      console.error("Inventory manager initialization error:", error);

      message(
        error.message || "Inventory Manager load nahi hua.",
        "error"
      );

      $("productTable").innerHTML =
        '<tr><td colspan="6" class="empty">Access ya loading error. Console check karo.</td></tr>';
    }
  }

  document.addEventListener("DOMContentLoaded", init);

})();