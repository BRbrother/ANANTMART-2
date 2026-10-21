/* =========================================================
   GRAM MART — PRODUCT DETAILS
   Supabase client: window.supabaseClient
   Tables: products, cart_items
   ========================================================= */

(() => {
  "use strict";

  const db = window.supabaseClient;
  const $ = (id) => document.getElementById(id);

  let currentProduct = null;
  let isAddingToCart = false;
  let selectedImageIndex = 0;

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  const PLACEHOLDER = "https://placehold.co/600x600?text=Gram+Mart";

  function formatPrice(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "₹0";

    return amount.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    });
  }

  function getStock(product) {
    if (product.stock == null) return null;
    const stock = Number(product.stock);
    return Number.isFinite(stock) ? stock : null;
  }

  function isProductActive(product) {
    return product.is_active !== false && product.active !== false;
  }

  function setStatus(message, type = "info") {
    const status = $("pageStatus");
    if (!status) return;

    status.hidden = false;
    status.textContent = message;
    status.style.color =
      type === "error" ? "#A52222" :
      type === "success" ? "#176B35" : "#647084";
  }

  function showMessage(message, type = "info") {
    const box = $("productMessage");

    if (!box) {
      alert(message);
      return;
    }

    box.textContent = message;
    box.className = `product-message ${type}`;
  }

  function setButtonState(text, disabled) {
    const button = $("addToCart");
    if (!button) return;

    button.textContent = text;
    button.disabled = Boolean(disabled);
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value ?? "";
  }

  function showMeta(wrapperId, valueId, value) {
    const wrapper = $(wrapperId);
    const element = $(valueId);

    if (!wrapper || !element) return;

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      element.textContent = String(value);
      wrapper.hidden = false;
    } else {
      wrapper.hidden = true;
      element.textContent = "";
    }
  }

  function getImages(product) {
    let images = [];

    if (Array.isArray(product.image_urls)) {
      images = product.image_urls;
    } else if (typeof product.image_urls === "string") {
      try {
        const parsed = JSON.parse(product.image_urls);
        if (Array.isArray(parsed)) images = parsed;
      } catch {
        images = [];
      }
    }

    const primaryImage = product.image_url || product.image || product.imageUrl;

    if (primaryImage && !images.includes(primaryImage)) {
      images.unshift(primaryImage);
    }

    return [...new Set(
      images.filter((url) => typeof url === "string" && url.trim() !== "")
    )].slice(0, 6);
  }

  function setMainImage(url, alt) {
    const image = $("productImage");
    if (!image) return;

    image.onerror = () => {
      image.onerror = null;
      image.src = PLACEHOLDER;
    };

    image.src = url || PLACEHOLDER;
    image.alt = alt || "Gram Mart product";
  }

  function renderGallery(product) {
    const images = getImages(product);
    const thumbnails = $("productThumbnails");
    const name = product.name || "Product";

    selectedImageIndex = 0;

    setMainImage(images[0] || PLACEHOLDER, name);

    if (!thumbnails) return;
    thumbnails.replaceChildren();

    images.forEach((url, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "product-thumbnail" + (index === 0 ? " active" : "");
      button.setAttribute("aria-label", `View product image ${index + 1}`);

      const thumb = document.createElement("img");
      thumb.src = url;
      thumb.alt = `${name} image ${index + 1}`;
      thumb.loading = "lazy";

      thumb.onerror = () => {
        button.remove();
        if (index === 0 && images.length > 1) {
          setMainImage(images[1], name);
        }
      };

      button.appendChild(thumb);

      button.addEventListener("click", () => {
        selectedImageIndex = index;
        setMainImage(url, `${name} image ${index + 1}`);

        thumbnails.querySelectorAll(".product-thumbnail")
          .forEach((item) => item.classList.remove("active"));

        button.classList.add("active");
      });

      thumbnails.appendChild(button);
    });
  }

  function renderPrice(product) {
    const sellingPrice = Number(product.price ?? 0);
    const mrp = product.mrp == null ? null : Number(product.mrp);

    setText("productPrice", formatPrice(sellingPrice));

    const mrpWrap = $("productMrpWrap");
    const mrpElement = $("productMrp");

    if (mrpWrap && mrpElement) {
      if (mrp !== null && Number.isFinite(mrp) && mrp > sellingPrice) {
        mrpElement.textContent = formatPrice(mrp);
        mrpWrap.hidden = false;
      } else {
        mrpWrap.hidden = true;
      }
    }

    const discountElement = $("productDiscount");

    if (discountElement) {
      let discount = 0;

      if (mrp !== null && Number.isFinite(mrp) && mrp > 0) {
        discount = Math.round(((mrp - sellingPrice) / mrp) * 100);
      }

      if (discount > 0 && discount <= 100) {
        discountElement.textContent = `${discount}% OFF`;
        discountElement.style.display = "inline-block";
      } else {
        discountElement.textContent = "";
        discountElement.style.display = "none";
      }
    }
  }

  function renderStock(product) {
    const stockElement = $("productStock");
    const quantityInput = $("productQty");
    const stock = getStock(product);
    const button = $("addToCart");

    if (!stockElement) return;

    if (stock === null) {
      stockElement.textContent = "Stock availability not confirmed";
      stockElement.className = "stock-status";
      if (quantityInput) quantityInput.removeAttribute("max");
      if (button) button.disabled = true;
      setButtonState("Check Availability", true);
      return;
    }

    if (stock <= 0) {
      stockElement.textContent = "Currently out of stock";
      stockElement.className = "stock-status out-of-stock";
      if (quantityInput) {
        quantityInput.max = "1";
        quantityInput.value = "1";
        quantityInput.disabled = true;
      }
      setButtonState("Out of Stock", true);
      return;
    }

    stockElement.textContent =
      stock <= 5 ? `Only ${stock} left in stock` : "In stock";
    stockElement.className = "stock-status in-stock";

    if (quantityInput) {
      quantityInput.disabled = false;
      quantityInput.min = "1";
      quantityInput.max = String(stock);
      quantityInput.step = "1";
      quantityInput.value = "1";
    }

    setButtonState("Add to Cart 🛒", false);
  }

  function renderVariants(product) {
    const section = $("variantSection");
    const container = $("variantOptions");

    if (!section || !container) return;

    container.replaceChildren();

    let variants = product.variants;

    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch {
        variants = [];
      }
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      section.hidden = true;
      return;
    }

    section.hidden = false;

    const note = document.createElement("p");
    note.style.cssText = "color:#647084;font-size:12px;margin:10px 0 0;";
    note.textContent =
      "Available product options are shown below. Confirm the selected option before ordering.";
    container.appendChild(note);

    variants.forEach((variant) => {
      if (!variant || typeof variant !== "object") return;

      const name = String(variant.name || "").trim();
      const value = String(variant.value || "").trim();

      if (!name && !value) return;

      const chip = document.createElement("span");
      chip.className = "variant-chip";
      chip.textContent = [name, value].filter(Boolean).join(": ");
      chip.style.cursor = "default";
      container.appendChild(chip);
    });
  }

  function renderProduct(product) {
    currentProduct = product;

    const name = product.name || product.title || "Product";
    const description =
      product.description ||
      product.short_description ||
      "Quality products for your everyday needs.";

    setText("productTitle", name);
    setText("productDescription", description);

    showMeta("productBrandWrap", "productBrand", product.brand);
    showMeta("productCategoryWrap", "productCategory", product.category);
    showMeta("productUnitWrap", "productUnit", product.unit);
    showMeta("productSkuWrap", "productSku", product.sku);

    const category = product.category || "Product Details";
    setText("breadcrumbCategory", category);

    document.title = `${name} | Gram Mart`;

    renderGallery(product);
    renderPrice(product);
    renderVariants(product);
    renderStock(product);

    const content = $("productContent");
    const pageStatus = $("pageStatus");

    if (content) content.hidden = false;
    if (pageStatus) pageStatus.hidden = true;

    const addButton = $("addToCart");
    if (addButton) addButton.onclick = addThisToCart;

    const cartButton = $("goToCart");
    if (cartButton) {
      cartButton.onclick = () => {
        window.location.href = "cart.html";
      };
    }
  }

  async function loadProductDetails() {
    if (!db) {
      setStatus("Supabase client missing. Check js/supabase.js.", "error");
      setButtonState("Unavailable", true);
      return;
    }

    if (!productId) {
      setStatus("Product ID missing. Please choose a product first.", "error");
      setButtonState("Unavailable", true);
      return;
    }

    setButtonState("Loading...", true);

    try {
      const { data: product, error } = await db
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();

      if (error) throw error;

      if (!product) {
        setStatus("Product nahi mila. Homepage se dobara select karo.", "error");
        setButtonState("Product Not Found", true);
        return;
      }

      if (!isProductActive(product)) {
        setStatus("Ye product abhi available nahi hai.", "error");
        setButtonState("Unavailable", true);
        return;
      }

      renderProduct(product);
    } catch (error) {
      console.error("Product fetch failed:", error);
      setStatus(
        `Product load nahi hua: ${error.message || "Please try again."}`,
        "error"
      );
      setButtonState("Try Again", false);

      const button = $("addToCart");
      if (button) button.onclick = loadProductDetails;
    }
  }

  async function addThisToCart() {
    if (isAddingToCart) return;

    if (!db || !currentProduct) {
      showMessage("Product abhi load nahi hua. Dobara try karo.", "error");
      return;
    }

    if (!isProductActive(currentProduct)) {
      showMessage("Ye product abhi available nahi hai.", "error");
      return;
    }

    const quantityInput = $("productQty");
    const quantity = Number(quantityInput?.value || 1);
    const stock = getStock(currentProduct);

    if (!Number.isInteger(quantity) || quantity < 1) {
      showMessage("Quantity kam se kam 1 whole number honi chahiye.", "error");
      return;
    }

    if (stock === null) {
      showMessage("Stock confirm nahi hai. Filhaal cart mein add nahi kar sakte.", "error");
      return;
    }

    if (quantity > stock) {
      showMessage(`Sirf ${stock} item stock mein available hain.`, "error");
      return;
    }

    isAddingToCart = true;
    setButtonState("Adding...", true);

    try {
      const { data: authData, error: authError } = await db.auth.getUser();

      if (authError) throw authError;

      const user = authData?.user;

      if (!user) {
        showMessage("Cart mein add karne ke liye pehle login karo.", "info");
        window.location.href = "login.html";
        return;
      }

      // Re-check current product and stock before cart modification.
      const { data: latestProduct, error: latestError } = await db
        .from("products")
        .select("id, price, stock, is_active")
        .eq("id", currentProduct.id)
        .maybeSingle();

      if (latestError) throw latestError;

      if (!latestProduct || latestProduct.is_active === false) {
        showMessage("Ye product ab available nahi hai.", "error");
        return;
      }

      const latestStock = Number(latestProduct.stock);

      if (!Number.isInteger(latestStock) || latestStock < 0) {
        showMessage("Product stock verify nahi ho paaya.", "error");
        return;
      }

      if (quantity > latestStock) {
        showMessage(`Sirf ${latestStock} item stock mein available hain.`, "error");
        return;
      }

      const { data: existingItems, error: lookupError } = await db
        .from("cart_items")
        .select("quantity")
        .eq("user_id", user.id)
        .eq("product_id", currentProduct.id)
        .limit(1);

      if (lookupError) throw lookupError;

      const existingItem = existingItems?.[0] || null;
      const oldQuantity = Number(existingItem?.quantity || 0);
      const newQuantity = oldQuantity + quantity;

      if (newQuantity > latestStock) {
        showMessage(
          `Cart mein total ${latestStock} se zyada items nahi ho sakte.`,
          "error"
        );
        return;
      }

      if (existingItem) {
        const { error: updateError } = await db
          .from("cart_items")
          .update({ quantity: newQuantity })
          .eq("user_id", user.id)
          .eq("product_id", currentProduct.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await db
          .from("cart_items")
          .insert({
            user_id: user.id,
            product_id: currentProduct.id,
            quantity
          });

        if (insertError) throw insertError;
      }

      showMessage("Product cart mein add ho gaya! 🛒", "success");
    } catch (error) {
      console.error("Add-to-cart failed:", error);

      if (error.code === "42501") {
        showMessage("Cart permission error. Supabase RLS policies check karo.", "error");
      } else {
        showMessage(
          error.message || "Product cart mein add nahi hua. Dobara try karo.",
          "error"
        );
      }
    } finally {
      isAddingToCart = false;

      if (currentProduct) {
        renderStock(currentProduct);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const quantityInput = $("productQty");

    if (quantityInput) {
      quantityInput.addEventListener("change", () => {
        if (!currentProduct) return;

        const stock = getStock(currentProduct);
        let quantity = Number(quantityInput.value);

        if (!Number.isInteger(quantity) || quantity < 1) {
          quantity = 1;
        }

        if (stock !== null) {
          quantity = Math.min(quantity, Math.max(1, stock));
        }

        quantityInput.value = String(quantity);
      });
    }

    loadProductDetails();
  });
})();