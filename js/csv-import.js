
(() => {
  "use strict";

  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);

  let previewProducts = [];
  let validProducts = [];

  const REQUIRED_HEADERS = [
    "product_title",
    "product_description",
    "mrp_inr",
    "selling_price_inr",
    "available_stock",
    "category",
    "sub_category"
  ];

  function status(message, error = false) {
    const el = $("csvImportStatus");
    el.textContent = message;
    el.style.color = error ? "#c62828" : "#0B3091";
  }

  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [], value = "", quoted = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"' && quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(value);
        if (row.some(cell => cell.trim() !== "")) rows.push(row);
        row = [];
        value = "";
      } else {
        value += char;
      }
    }

    row.push(value);
    if (row.some(cell => cell.trim() !== "")) rows.push(row);

    if (quoted) throw new Error("CSV mein quotation marks incomplete hain.");

    const headers = rows.shift()?.map(h => h.trim().toLowerCase()) || [];
    if (!headers.length) throw new Error("CSV file empty hai.");

    const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missing.length) {
      throw new Error("CSV columns missing: " + missing.join(", "));
    }

    return rows.map((cells, index) => {
      const item = {};
      headers.forEach((header, i) => item[header] = (cells[i] || "").trim());
      item._row = index + 2;
      return item;
    });
  }

  function number(value, field, row, allowZero = true) {
    const n = Number(value);
    if (value === "" || !Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
      throw new Error(`Row ${row}: ${field} invalid hai.`);
    }
    return n;
  }

  function mapProduct(r) {
    const name = r.product_title;
    const description = r.product_description;
    const category = r.category;
    const subcategory = r.sub_category;
    const mrp = number(r.mrp_inr, "MRP", r._row, false);
    const price = number(r.selling_price_inr, "Selling price", r._row, false);
    const stock = number(r.available_stock, "Stock", r._row);

    if (!name || !description || !category || !subcategory) {
      throw new Error(`Row ${r._row}: name, description, category aur sub-category required hain.`);
    }
    if (price > mrp) {
      throw new Error(`Row ${r._row}: selling price MRP se zyada hai.`);
    }
    if (!Number.isInteger(stock)) {
      throw new Error(`Row ${r._row}: stock whole number hona chahiye.`);
    }

    const imageUrls = [
      r.main_image_url,
      r.image_2_url,
      r.image_3_url,
      r.image_4_url,
      r.image_5_url,
      r.image_6_url
    ].filter(Boolean);

    for (const url of imageUrls) {
      let parsed;
      try { parsed = new URL(url); } catch { throw new Error(`Row ${r._row}: image URL invalid hai.`); }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error(`Row ${r._row}: image URL HTTP/HTTPS honi chahiye.`);
      }
    }

    const variant = r.variant_name || r.variant_value || r.variant_sku
      ? [{
          name: r.variant_name || "",
          value: r.variant_value || "",
          sku: r.variant_sku || ""
        }]
      : [];

    return {
      name,
      description,
      brand: r.brand_name || null,
      sku: r.sku_product_code || null,
      barcode: r.barcode || null,
      unit: r.pack_size_unit || null,
      mrp,
      price,
      discount: Math.round(((mrp - price) / mrp) * 100),
      stock,
      category,
      subcategory,
      keywords: (r.search_keywords || "")
        .split(",").map(x => x.trim()).filter(Boolean),
      variants: variant,
      image_url: imageUrls[0] || null,
      image_urls: imageUrls,
      is_active: true,
      is_featured: false
    };
  }

  function showPreview(products, errors) {
    const container = $("csvPreview");
    container.replaceChildren();

    const heading = document.createElement("p");
    heading.textContent = `${products.length} valid products | ${errors.length} errors`;
    container.appendChild(heading);

    const table = document.createElement("div");
    table.style.overflowX = "auto";

    const preview = products.slice(0, 15);
    const tableEl = document.createElement("table");
    tableEl.className = "order-table";

    const head = document.createElement("tr");
    ["Product", "MRP", "Selling Price", "Stock", "Category"].forEach(t => {
      const th = document.createElement("th");
      th.textContent = t;
      head.appendChild(th);
    });

    const thead = document.createElement("thead");
    thead.appendChild(head);
    tableEl.appendChild(thead);

    const tbody = document.createElement("tbody");

    preview.forEach(p => {
      const tr = document.createElement("tr");
      [p.name, p.mrp, p.price, p.stock, p.category].forEach(v => {
        const td = document.createElement("td");
        td.textContent = String(v);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    tableEl.appendChild(tbody);
    table.appendChild(tableEl);
    container.appendChild(table);

    if (products.length > 15) {
      const note = document.createElement("p");
      note.textContent = `First 15 products shown. Total valid: ${products.length}`;
      container.appendChild(note);
    }

    errors.slice(0, 10).forEach(error => {
      const p = document.createElement("p");
      p.style.color = "#c62828";
      p.textContent = error;
      container.appendChild(p);
    });
  }

  async function verifyAdmin() {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Admin login required.");

    const { data: allowed, error: adminError } = await db.rpc("is_admin");
    if (adminError) throw adminError;
    if (allowed !== true) throw new Error("Admin access denied.");
  }

  async function previewCSV() {
    try {
      if (!db) throw new Error("Supabase connection nahi mila.");
      await verifyAdmin();

      const file = $("csvFile").files[0];
      if (!file) throw new Error("Pehle CSV file select karo.");

      const text = await file.text();
      const rows = parseCSV(text);
      const products = [];
      const errors = [];
      const seen = new Set();

      rows.forEach(row => {
        try {
          const product = mapProduct(row);
          const sku = product.sku?.toLowerCase();

          if (sku && seen.has(sku)) {
            throw new Error(`Row ${row._row}: duplicate SKU in CSV.`);
          }
          if (sku) seen.add(sku);
          products.push(product);
        } catch (e) {
          errors.push(e.message);
        }
      });

      previewProducts = products;
      validProducts = [];
      $("importCsvBtn").disabled = true;

      showPreview(products, errors);

      if (errors.length) {
        status("CSV mein errors hain. Import rok diya gaya hai.", true);
      } else if (!products.length) {
        status("Import ke liye products nahi mile.", true);
      } else {
        status(`${products.length} products preview ready. Import se pehle details check karo.`);
        validProducts = products;
        $("importCsvBtn").disabled = false;
      }
    } catch (e) {
      status(e.message, true);
    }
  }

  async function importCSV() {
    const button = $("importCsvBtn");

    if (!validProducts.length) return;

    if (!confirm(`${validProducts.length} products Supabase mein add karne hain?`)) return;

    button.disabled = true;

    try {
      await verifyAdmin();

      const skus = validProducts.map(p => p.sku).filter(Boolean);

      if (skus.length) {
        const { data, error } = await db
          .from("products")
          .select("sku")
          .in("sku", skus);

        if (error) throw error;

        const existing = new Set((data || []).map(p => p.sku?.toLowerCase()));
        const duplicates = validProducts.filter(
          p => p.sku && existing.has(p.sku.toLowerCase())
        );

        if (duplicates.length) {
          throw new Error(
            `${duplicates.length} SKU pehle se database mein hain. Import rok diya.`
          );
        }
      }

      let inserted = 0;

      for (let i = 0; i < validProducts.length; i += 25) {
        const batch = validProducts.slice(i, i + 25);
        const { error } = await db.from("products").insert(batch);
        if (error) {
          throw new Error(`Batch ${Math.floor(i / 25) + 1} failed: ${error.message}. ${inserted} products pehle insert hue.`);
        }
        inserted += batch.length;
        status(`${inserted} / ${validProducts.length} products imported...`);
      }

      status(`Success! ${inserted} products import ho gaye.`);
      $("csvFile").value = "";
      $("csvPreview").replaceChildren();
      validProducts = [];
      previewProducts = [];

      if (typeof loadProducts === "function") await loadProducts();
    } catch (e) {
      console.error("CSV import error:", e);
      status(e.message, true);
    } finally {
      button.disabled = true;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("previewCsvBtn")?.addEventListener("click", previewCSV);
    $("importCsvBtn")?.addEventListener("click", importCSV);
  });
})();
      
