const client = () => window.supabaseClient;

function showCartMessage(message, color = "white") {
  const container = document.getElementById("cartItems");
  if (!container) return;

  container.replaceChildren();

  const p = document.createElement("p");
  p.textContent = message;
  p.style.cssText = `color:${color};padding:20px;text-align:center;`;
  container.appendChild(p);
}

function getProductName(product) {
  return product.name || product.title || product.product_name || "Product";
}

function getProductPrice(product) {
  return Number(product.price ?? product.selling_price ?? 0);
}

function getProductImage(product) {
  return product.image_url || product.image || product.imageUrl || "";
}

async function getCurrentUser() {
  const supabase = client();

  if (!supabase) {
    throw new Error("Supabase client nahi mila. js/supabase.js check karo.");
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) return null;

  return data.user;
}

async function loadCartFromServer() {
  const totalElement = document.getElementById("cartTotal");

  try {
    const user = await getCurrentUser();

    if (!user) {
      showCartMessage("Please login to see your cart items.");
      if (totalElement) totalElement.textContent = "0";
      return;
    }

    const supabase = client();

    // Current user ke cart items load karo
    const { data: cartItems, error: cartError } = await supabase
      .from("cart_items")
      .select("user_id, product_id, quantity, created_at")
      .eq("user_id", user.id);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      showCartMessage("Your cart is empty! 🛒");
      if (totalElement) totalElement.textContent = "0";
      return;
    }

    // Products table se product details lao
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

    let total = 0;

    cartItems.forEach(item => {
      const product = productMap.get(String(item.product_id));

      if (!product) return;

      const quantity = Math.max(1, Number(item.quantity) || 1);
      const price = getProductPrice(product);
      const itemTotal = price * quantity;

      total += itemTotal;

      const card = document.createElement("div");
      card.style.cssText =
        "padding:16px;margin:12px 0;border:1px solid #ddd;border-radius:10px;";

      const name = document.createElement("h3");
      name.textContent = getProductName(product);
      card.appendChild(name);

      const imageUrl = getProductImage(product);

      if (imageUrl) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = getProductName(product);
        image.loading = "lazy";
        image.style.cssText =
          "width:100px;height:100px;object-fit:contain;";
        card.appendChild(image);
      }

      const priceText = document.createElement("p");
      priceText.textContent = `Price: ₹${price.toFixed(2)}`;
      card.appendChild(priceText);

      const quantityText = document.createElement("p");
      quantityText.textContent = `Quantity: ${quantity}`;
      card.appendChild(quantityText);

      const subtotal = document.createElement("p");
      subtotal.textContent = `Subtotal: ₹${itemTotal.toFixed(2)}`;
      card.appendChild(subtotal);

      const decreaseButton = document.createElement("button");
      decreaseButton.textContent = "−";
      decreaseButton.disabled = quantity <= 1;
      decreaseButton.addEventListener("click", () => {
        updateCartQuantity(item.product_id, quantity - 1);
      });

      const increaseButton = document.createElement("button");
      increaseButton.textContent = "+";
      increaseButton.addEventListener("click", () => {
        updateCartQuantity(item.product_id, quantity + 1);
      });

      const removeButton = document.createElement("button");
      removeButton.textContent = "Remove";
      removeButton.style.marginLeft = "10px";
      removeButton.addEventListener("click", () => {
        removeCartItem(item.product_id);
      });

      card.append(decreaseButton, increaseButton, removeButton);
      container.appendChild(card);
    });

    if (totalElement) {
      totalElement.textContent = total.toFixed(2);
    }

    if (container.childElementCount === 0) {
      showCartMessage(
        "Cart items mil gaye, lekin matching products nahi mile.",
        "orange"
      );
    }
  } catch (error) {
    console.error("Supabase cart loading error:", error);
    showCartMessage(
      error.message || "Cart load nahi hua. Supabase settings check karo.",
      "red"
    );
  }
}

async function updateCartQuantity(productId, quantity) {
  if (quantity < 1) return;

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

// Checkout ko abhi purane backend par mat bhejo.
// Secure Supabase checkout alag se configure karna hai.
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