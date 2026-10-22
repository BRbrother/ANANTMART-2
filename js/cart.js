const client = () => window.supabaseClient;

const FREE_DELIVERY_MINIMUM = 300;
const DELIVERY_FEE = 30;

function calculateDeliveryCharge(subtotal) {
  return subtotal >= FREE_DELIVERY_MINIMUM ? 0 : DELIVERY_FEE;
}

function updateCartSummary(subtotal) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const deliveryCharge = safeSubtotal > 0
    ? calculateDeliveryCharge(safeSubtotal)
    : 0;
  const grandTotal = safeSubtotal + deliveryCharge;

  const subtotalElement = document.getElementById("cartSubtotal");
  const deliveryElement = document.getElementById("deliveryCharge");
  const totalElement = document.getElementById("cartTotal");
  const noteElement = document.getElementById("deliveryNote");

  if (subtotalElement) {
    subtotalElement.textContent = `₹${safeSubtotal.toFixed(2)}`;
  }

  if (deliveryElement) {
    deliveryElement.textContent = deliveryCharge === 0
      ? "FREE"
      : `₹${deliveryCharge.toFixed(2)}`;
  }

  if (totalElement) {
    totalElement.textContent = grandTotal.toFixed(2);
  }

  if (noteElement) {
    if (safeSubtotal === 0) {
      noteElement.textContent =
        "🛍️ ₹300 ya usse zyada ki shopping par FREE delivery!";
    } else if (deliveryCharge === 0) {
      noteElement.textContent =
        "🎉 Congratulations! Aapki delivery FREE hai.";
    } else {
      const remaining = FREE_DELIVERY_MINIMUM - safeSubtotal;
      noteElement.textContent =
        `🛍️ ₹${remaining.toFixed(2)} aur shopping karein aur delivery FREE paayein! Abhi delivery charge ₹30 hai.`;
    }
  }

  return { subtotal: safeSubtotal, deliveryCharge, grandTotal };
}

function showCartMessage(message, color = "inherit") {
  const container = document.getElementById("cartItems");
  if (!container) return;

  container.replaceChildren();

  const p = document.createElement("p");
  p.textContent = message;
  p.style.cssText =
    `color:${color};padding:20px;text-align:center;`;
  container.appendChild(p);
}

function getProductName(product) {
  return product.name || product.title ||
    product.product_name || "Product";
}

function getProductPrice(product) {
  const price = Number(product.price ?? product.selling_price ?? 0);
  return Number.isFinite(price) && price >= 0 ? price : 0;
}

function getProductImage(product) {
  return product.image_url || product.image ||
    product.imageUrl || "";
}

async function getCurrentUser() {
  const supabase = client();

  if (!supabase) {
    throw new Error(
      "Supabase client nahi mila. js/supabase.js check karo."
    );
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) return null;

  return data.user;
}

async function loadCartFromServer() {
  updateCartSummary(0);

  try {
    const user = await getCurrentUser();

    if (!user) {
      showCartMessage("Please login to see your cart items.");
      return;
    }

    const supabase = client();

    const { data: cartItems, error: cartError } = await supabase
      .from("cart_items")
      .select("user_id, product_id, quantity, created_at")
      .eq("user_id", user.id);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      showCartMessage("Your cart is empty! 🛒");
      return;
    }

    const productIds = [
      ...new Set(cartItems.map(item => item.product_id))
    ];

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);

    if (productsError) throw productsError;

    const productMap = new Map(
      (products || []).map(product => [
        String(product.id),
        product
      ])
    );

    const container = document.getElementById("cartItems");
    if (!container) return;

    container.replaceChildren();

    let subtotalAmount = 0;

    cartItems.forEach(item => {
      const product = productMap.get(String(item.product_id));
      if (!product) return;

      const quantity = Math.max(
        1,
        Math.floor(Number(item.quantity) || 1)
      );

      const price = getProductPrice(product);
      const itemTotal = price * quantity;

      subtotalAmount += itemTotal;

      const card = document.createElement("div");
      card.className = "cart-product";
      card.style.cssText =
        "padding:16px;margin:12px 0;border:1px solid #ddd;border-radius:10px;";

      const imageUrl = getProductImage(product);

      if (imageUrl) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = getProductName(product);
        image.loading = "lazy";
        image.onerror = () => image.remove();
        card.appendChild(image);
      }

      const info = document.createElement("div");
      info.className = "cart-product-info";

      const name = document.createElement("h3");
      name.textContent = getProductName(product);

      const priceText = document.createElement("p");
      priceText.className = "cart-price";
      priceText.textContent = `₹${price.toFixed(2)} each`;

      const itemSubtotal = document.createElement("p");
      itemSubtotal.textContent =
        `Item total: ₹${itemTotal.toFixed(2)}`;

      const quantityControls = document.createElement("div");
      quantityControls.className = "quantity-controls";

      const decreaseButton = document.createElement("button");
      decreaseButton.type = "button";
      decreaseButton.textContent = "−";
      decreaseButton.setAttribute("aria-label", "Decrease quantity");
      decreaseButton.disabled = quantity <= 1;
      decreaseButton.addEventListener("click", () => {
        updateCartQuantity(item.product_id, quantity - 1);
      });

      const quantityValue = document.createElement("span");
      quantityValue.textContent = String(quantity);

      const increaseButton = document.createElement("button");
      increaseButton.type = "button";
      increaseButton.textContent = "+";
      increaseButton.setAttribute("aria-label", "Increase quantity");
      increaseButton.addEventListener("click", () => {
        updateCartQuantity(item.product_id, quantity + 1);
      });

      quantityControls.append(
        decreaseButton,
        quantityValue,
        increaseButton
      );

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        removeCartItem(item.product_id);
      });

      info.append(name, priceText, itemSubtotal, quantityControls, removeButton);
      card.appendChild(info);
      container.appendChild(card);
    });

    updateCartSummary(subtotalAmount);

    if (container.childElementCount === 0) {
      updateCartSummary(0);
      showCartMessage(
        "Cart items mil gaye, lekin matching products nahi mile.",
        "#b45309"
      );
    }
  } catch (error) {
    console.error("Supabase cart loading error:", error);
    updateCartSummary(0);
    showCartMessage(
      error.message || "Cart load nahi hua. Supabase settings check karo.",
      "#d32f2f"
    );
  }
}

async function updateCartQuantity(productId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1) return;

  try {
    const user = await getCurrentUser();

    if (!user) {
      alert("Please login again.");
      return;
    }

    const { error } = await client()
      .from("cart_items")
      .update({ quantity })
      .eq("user_id", user.id)
      .eq("product_id", productId);

    if (error) throw error;

    await loadCartFromServer();
  } catch (error) {
    console.error("Cart quantity update error:", error);
    alert(error.message || "Quantity update nahi hui.");
  }
}

async function removeCartItem(productId) {
  if (!confirm("Kya aap ye product cart se remove karna chahte hain?")) {
    return;
  }

  try {
    const user = await getCurrentUser();

    if (!user) {
      alert("Please login again.");
      return;
    }

    const { error } = await client()
      .from("cart_items")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);

    if (error) throw error;

    await loadCartFromServer();
  } catch (error) {
    console.error("Cart remove error:", error);
    alert(error.message || "Product remove nahi hua.");
  }
}

async function clearCartLocal() {
  if (!confirm("Kya aap poora cart empty karna chahte hain?")) {
    return;
  }

  try {
    const user = await getCurrentUser();

    if (!user) {
      alert("Please login again.");
      return;
    }

    const { error } = await client()
      .from("cart_items")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;

    await loadCartFromServer();
  } catch (error) {
    console.error("Clear cart error:", error);
    alert(error.message || "Cart clear nahi hua.");
  }
}

// Secure checkout abhi alag se configure karna baaki hai.
async function placeOrderNow() {
  alert(
    "Checkout abhi configure nahi hua hai. " +
    "Order place karne se pehle secure checkout setup karna hoga."
  );
}

window.loadCartFromServer = loadCartFromServer;
window.updateCartQuantity = updateCartQuantity;
window.removeCartItem = removeCartItem;
window.clearCartLocal = clearCartLocal;
window.placeOrderNow = placeOrderNow;

document.addEventListener("DOMContentLoaded", loadCartFromServer);