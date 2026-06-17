// =======================================================
// ANANTMART - PRODUCTION READY CLEAN CART LOGIC (DAY 15)
// =======================================================

// MASTER URL: Pure file ke liye ek hi baar live link set kar diya
const BACKEND_URL = "https://anantmart-backend.onrender.com";

async function loadCartFromServer() {
  const cartItemsContainer = document.getElementById("cartItems");
  const cartTotalElement = document.getElementById("cartTotal");
  
  // Browser se safe tarike se token nikalna
  const token = localStorage.getItem("anantmart_token") || localStorage.getItem("token");

  if (!token) {
    if (cartItemsContainer) {
      cartItemsContainer.innerHTML = "<p style='color:white; padding:20px; text-align:center;'>Please login to see your cart items.</p>";
    }
    return;
  }

  try {
    // 1. FIXED: Backend se logged-in user ka cart lana (Render URL connected)
    const response = await fetch(`${BACKEND_URL}/cart`, {
      method: "GET",
      headers: {
        "authorization": token,
        "Content-Type": "application/json"
      }
    });

    // Token invalid hone par safe return
    if (response.status === 401 || response.status === 403) {
      if (cartItemsContainer) {
        cartItemsContainer.innerHTML = "<p style='color:red; text-align:center;'>Session Expired! Please login again.</p>";
      }
      return;
    }

    const cartData = await response.json();

    // 2. FIXED: Main products ki list lana details match karne ke liye
    const prodResponse = await fetch(`${BACKEND_URL}/products`);
    const allProducts = await prodResponse.json();

    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = ""; 

    if (!cartData || cartData.length === 0) {
      cartItemsContainer.innerHTML = "<p style='color:white; padding:20px; text-align:center;'>Your cart is empty! 🛒</p>";
      if (cartTotalElement) cartTotalElement.innerText = "0";
      return;
    }

    let totalCartPrice = 0;
    let itemsFoundCount = 0;

    // 3. Products grid render karna aur price calculate karna
    cartData.forEach(cartItem => {
      if (!cartItem || !cartItem.productId) return; 

      const matchingProduct = allProducts.find(p => {
        if (!p) return false;
        const pId = p._id || p.id;
        return String(pId) === String(cartItem.productId);
      });

      if (matchingProduct) {
        itemsFoundCount++;
        const itemTotal = Number(matchingProduct.price || 0) * Number(cartItem.quantity || 1);
        totalCartPrice += itemTotal;

        // Safe HTML injection template literal ke sath
        cartItemsContainer.innerHTML += `
          <div class="cart-item" style="display:flex; justify-content:space-between; background:#1a1a2e; color:white; padding:15px; margin:10px auto; max-width:600px; border-radius:5px; align-items:center; border: 1px solid #f0a500;">
            <div style="text-align: left;">
              <h3 style="margin:0; color:#f0a500;">${matchingProduct.name}</h3>
              <p style="margin:5px 0 0 0; color:#ccc;">Price: ₹${matchingProduct.price}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin:0;">Qty: <b>${cartItem.quantity}</b></p>
              <p style="margin:5px 0 0 0; color:#f0a500;">Total: <b>₹${itemTotal}</b></p>
            </div>
          </div>
        `;
      }
    });

    if (itemsFoundCount === 0 && cartData.length > 0) {
      cartItemsContainer.innerHTML = "<p style='color:orange; padding:20px; text-align:center;'>Cart items found, but matching product details missing in Database!</p>";
    }

    if (cartTotalElement) {
      cartTotalElement.innerText = totalCartPrice;
    }

  } catch (error) {
    console.error("Cart Loading Error:", error);
    if (cartItemsContainer) {
      cartItemsContainer.innerHTML = "<p style='color:red; text-align:center;'>Server connection error!</p>";
    }
  }
}

// =======================================================
// 4. CHECKOUT / PLACE ORDER LOGIC (WINDOW SCOPE FOR HTML)
// =======================================================
window.placeOrderNow = async function() {
  const token = localStorage.getItem("anantmart_token") || localStorage.getItem("token");

  if (!token) {
    alert("Please login to checkout!");
    window.location.href = "login.html";
    return;
  }

  const confirmOrder = confirm("Kya aap order confirm karna chahte hain?");
  if (!confirmOrder) return;

  try {
    // FIXED: Localhost hata kar global BACKEND_URL lagaya
    const response = await fetch(`${BACKEND_URL}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authorization": token
      }
    });

    const result = await response.json();

    if (response.status === 201 || response.status === 200) {
      alert(`🎉 Order Success!\nOrder ID: ${result.orderId}\nTotal Bill: ₹${result.totalBill || 0}\n\nThank you for shopping on ANANTMART!`);
      window.location.href = "index.html"; 
    } else {
      alert("Error: " + result.message);
    }

  } catch (error) {
    console.error("Checkout error:", error);
    alert("Server issue! Order place nahi ho paya.");
  }
};

function clearCartLocal() {
  const confirmClear = confirm("Kya aap apna poora cart khali karna chahte hain?");
  if (confirmClear) {
    const cartItemsContainer = document.getElementById("cartItems");
    const cartTotalElement = document.getElementById("cartTotal");
    if (cartItemsContainer) cartItemsContainer.innerHTML = "<p style='color:white; padding:20px; text-align:center;'>Your cart is empty! 🛒</p>";
    if (cartTotalElement) cartTotalElement.innerText = "0";
  }
}

document.addEventListener("DOMContentLoaded", loadCartFromServer);