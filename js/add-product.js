(() => {
  "use strict";

  const db = window.supabaseClient;

  const MAX_IMAGES = 6;
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const BUCKET = "gram-mart-products";
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif"
  ];

  const $ = (id) => document.getElementById(id);

  let uploadedPaths = [];
  let isSaving = false;

  function showStatus(message, type = "info") {
    const status = $("status");
    if (!status) return;

    status.textContent = message;
    status.dataset.type = type;
    status.style.color =
      type === "error" ? "#c62828" :
      type === "success" ? "#16803c" : "#0B3091";
  }

  function getValue(id) {
    return $(id)?.value?.trim() ?? "";
  }

  function calculateDiscount() {
    const mrp = Number(getValue("mrp"));
    const price = Number(getValue("price"));
    const discountField = $("discount");

    if (!discountField) return;

    if (mrp > 0 && price >= 0 && price <= mrp) {
      discountField.value = String(
        Math.round(((mrp - price) / mrp) * 100)
      );
    } else {
      discountField.value = "0";
    }
  }

  function isValidHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }

  async function verifyAdmin() {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      window.location.href = "./login.html";
      return false;
    }

    const { data: isAdmin, error: adminError } =
      await db.rpc("is_admin");

    if (adminError) throw adminError;

    if (isAdmin !== true) {
      showStatus("Access denied: admin account required.", "error");
      window.location.href = "./index.html";
      return false;
    }

    return true;
  }

  function makeImageSlot(index) {
    const slot = document.createElement("div");
    slot.className = "image-slot";
    slot.style.cssText =
      "border:1px solid #ddd;border-radius:10px;padding:12px;margin:10px 0;";

    const title = document.createElement("label");
    title.textContent = `Product Image ${index + 1}${index === 0 ? " (Main)" : ""}`;
    title.style.display = "block";

    const urlLabel = document.createElement("label");
    urlLabel.textContent = "Image URL (optional)";
    urlLabel.style.display = "block";
    urlLabel.style.marginTop = "8px";

    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.className = "image-url";
    urlInput.placeholder = "https://example.com/image.webp";
    urlInput.style.width = "100%";

    const fileLabel = document.createElement("label");
    fileLabel.textContent = "Or upload an image";
    fileLabel.style.display = "block";
    fileLabel.style.marginTop = "8px";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ALLOWED_TYPES.join(",");
    fileInput.className = "image-file";

    const preview = document.createElement("img");
    preview.alt = `Product image preview ${index + 1}`;
    preview.style.cssText =
      "display:none;width:120px;height:120px;object-fit:contain;margin-top:10px;border:1px solid #eee;border-radius:8px;";

    let previewObjectUrl = null;

    function clearPreview() {
      preview.style.display = "none";
      preview.removeAttribute("src");

      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
      }
    }

    urlInput.addEventListener("input", () => {
      fileInput.value = "";
      clearPreview();

      if (isValidHttpUrl(urlInput.value.trim())) {
        preview.src = urlInput.value.trim();
        preview.style.display = "block";
      }
    });

    fileInput.addEventListener("change", () => {
      clearPreview();
      urlInput.value = "";

      const file = fileInput.files?.[0];
      if (!file) return;

      if (!ALLOWED_TYPES.includes(file.type)) {
        showStatus("Use a JPEG, PNG, WebP or AVIF image.", "error");
        fileInput.value = "";
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        showStatus("Image must be 5 MB or smaller.", "error");
        fileInput.value = "";
        return;
      }

      previewObjectUrl = URL.createObjectURL(file);
      preview.src = previewObjectUrl;
      preview.style.display = "block";
    });

    slot.append(title, urlLabel, urlInput, fileLabel, fileInput, preview);

    return {
      element: slot,
      urlInput,
      fileInput,
      clearPreview
    };
  }

  let imageControls = [];

  function buildImageSlots() {
    const container = $("imageSlots");
    if (!container) {
      throw new Error('Missing HTML element: "imageSlots".');
    }

    imageControls.forEach((control) => control.clearPreview());
    imageControls = [];
    container.replaceChildren();

    for (let i = 0; i < MAX_IMAGES; i++) {
      const control = makeImageSlot(i);
      imageControls.push(control);
      container.appendChild(control.element);
    }
  }

  function addVariantRow() {
    const container = $("variants");
    if (!container) {
      throw new Error('Missing HTML element: "variants".');
    }

    const row = document.createElement("div");
    row.className = "variant-row";
    row.style.cssText =
      "display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin:8px 0;";

    const fields = [
      { key: "name", placeholder: "Variant (e.g. Size)" },
      { key: "value", placeholder: "Value (e.g. 1 kg)" },
      { key: "sku", placeholder: "Variant SKU (optional)" }
    ];

    fields.forEach((field) => {
      const input = document.createElement("input");
      input.type = "text";
      input.dataset.key = field.key;
      input.placeholder = field.placeholder;
      input.style.minWidth = "0";
      row.appendChild(input);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => row.remove());

    row.appendChild(remove);
    container.appendChild(row);
  }

  function collectVariants() {
    const container = $("variants");
    if (!container) return [];

    return [...container.querySelectorAll(".variant-row")]
      .map((row) => ({
        name: row.querySelector('[data-key="name"]')?.value.trim() || "",
        value: row.querySelector('[data-key="value"]')?.value.trim() || "",
        sku: row.querySelector('[data-key="sku"]')?.value.trim() || ""
      }))
      .filter((variant) => variant.name || variant.value || variant.sku)
      .map((variant) => {
        if (!variant.name || !variant.value) {
          throw new Error("Each variant needs both a name and a value.");
        }
        return variant;
      });
  }

  async function uploadImage(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`Unsupported image type: ${file.name}`);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`${file.name} is larger than 5 MB.`);
    }

    const extensionByType = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif"
    };

    const extension = extensionByType[file.type];
    const path =
      `products/${crypto.randomUUID()}.${extension}`;

    const { data, error } = await db.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });

    if (error) throw error;

    uploadedPaths.push(data.path);

    const { data: publicData } = db.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    if (!publicData?.publicUrl) {
      throw new Error("Could not create a public image URL.");
    }

    return publicData.publicUrl;
  }

  async function collectImageUrls() {
    const urls = [];

    for (const control of imageControls) {
      const file = control.fileInput.files?.[0];
      const url = control.urlInput.value.trim();

      if (file && url) {
        throw new Error("Choose either a file or a URL for each image.");
      }

      if (file) {
        showStatus(`Uploading image ${urls.length + 1}...`);
        urls.push(await uploadImage(file));
      } else if (url) {
        if (!isValidHttpUrl(url)) {
          throw new Error("Please enter a valid HTTP or HTTPS image URL.");
        }
        urls.push(url);
      }
    }

    return urls;
  }

  function validateForm() {
    const name = getValue("name");
    const description = getValue("description");
    const category = getValue("category");
    const subcategory = getValue("subcategory");
    const mrp = Number(getValue("mrp"));
    const price = Number(getValue("price"));
    const stockText = getValue("stock");
    const stock = Number(stockText);

    if (!name) throw new Error("Enter the product name.");
    if (!description) throw new Error("Enter the product description.");
    if (!category) throw new Error("Select a category.");
    if (!subcategory) throw new Error("Enter a subcategory.");

    if (!Number.isFinite(mrp) || mrp <= 0) {
      throw new Error("MRP must be greater than zero.");
    }

    if (!Number.isFinite(price) || price <= 0 || price > mrp) {
      throw new Error("Selling price must be greater than zero and no more than MRP.");
    }

    if (
      stockText === "" ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      throw new Error("Stock must be a whole number of zero or more.");
    }

    return {
      name,
      description,
      category,
      subcategory,
      mrp,
      price,
      stock,
      discount: Math.round(((mrp - price) / mrp) * 100)
    };
  }

  async function cleanupUploadedImages() {
    if (!uploadedPaths.length) return;

    try {
      const { error } = await db.storage
        .from(BUCKET)
        .remove(uploadedPaths);

      if (error) {
        console.warn("Some uploaded images may need manual cleanup:", error);
      }
    } catch (error) {
      console.warn("Image cleanup failed:", error);
    }

    uploadedPaths = [];
  }

  function resetForm() {
    $("addProductForm").reset();

    const variants = $("variants");
    if (variants) variants.replaceChildren();

    uploadedPaths = [];
    buildImageSlots();
    addVariantRow();
    calculateDiscount();

    if ($("active")) $("active").checked = true;
    if ($("featured")) $("featured").checked = false;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSaving) return;

    const form = $("addProductForm");
    const saveBtn = $("saveBtn");

    if (!form || !saveBtn) {
      showStatus("Product form or save button is missing from the HTML.", "error");
      return;
    }

    isSaving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    uploadedPaths = [];

    let productSaved = false;

    try {
      const isAdmin = await verifyAdmin();
      if (!isAdmin) return;

      const values = validateForm();
      const variants = collectVariants();
      const keywords = getValue("keywords")
        .split(",")
        .map((word) => word.trim())
        .filter(Boolean);

      const brand = getValue("brand") || null;
      const sku = getValue("sku") || null;
      const barcode = getValue("barcode") || null;
      const unit = getValue("unit") || null;

      const imageUrls = await collectImageUrls();

      showStatus("Saving product...");

      const productData = {
        name: values.name,
        description: values.description,
        brand,
        sku,
        barcode,
        unit,
        mrp: values.mrp,
        price: values.price,
        discount: values.discount,
        stock: values.stock,
        category: values.category,
        subcategory: values.subcategory,
        keywords,
        variants,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls,
        is_active: $("active") ? $("active").checked : true,
        is_featured: $("featured") ? $("featured").checked : false
      };

      const { data, error } = await db
        .from("products")
        .insert(productData)
        .select("id")
        .single();

      if (error) throw error;

      productSaved = true;

      showStatus(
        `Product saved successfully! Product ID: ${data.id}`,
        "success"
      );

      resetForm();
    } catch (error) {
      console.error("Product save error:", error);

      if (!productSaved) {
        await cleanupUploadedImages();
      }

      let message = error?.message || "An unknown error occurred.";

      if (error?.code === "42501") {
        message = "Permission denied. Check admin role and Supabase RLS/storage policies.";
      } else if (
        error?.code === "42703" ||
        error?.code === "PGRST204" ||
        /schema cache|column .* does not exist/i.test(message)
      ) {
        message = "A product column is missing or not refreshed in Supabase. Check the products table schema.";
      } else if (/JWT|token|session/i.test(message)) {
        message = "Your login session may have expired. Please log in again.";
      }

      showStatus(`Could not save product: ${message}`, "error");
    } finally {
      isSaving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Product";
    }
  }

  async function init() {
    if (!db) {
      showStatus("Supabase client not found. Check js/supabase.js.", "error");
      return;
    }

    try {
      buildImageSlots();

      if ($("variants")) {
        $("variants").replaceChildren();
        addVariantRow();
      }

      $("addVariant")?.addEventListener("click", addVariantRow);
      $("mrp")?.addEventListener("input", calculateDiscount);
      $("price")?.addEventListener("input", calculateDiscount);
      $("addProductForm")?.addEventListener("submit", handleSubmit);

      const authorized = await verifyAdmin();

      if (authorized) {
        calculateDiscount();
        showStatus("Ready to add a product.");
      }
    } catch (error) {
      console.error("Admin page initialization error:", error);
      showStatus(error?.message || "Could not initialize the product form.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();