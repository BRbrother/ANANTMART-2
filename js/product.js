// =======================================================
// ANANTMART - PRODUCTION READY DYNAMIC PRODUCT DETAILS (DAY 16)
// =======================================================

const BACKEND_URL = "https://anantmart-backend.onrender.com";

// URL se Product ID nikaalna (e.g., product.html?id=12345)
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

async function loadProductDetails() {
  if (!productId) {
    alert("Bhai, koi product select nahi kiya gaya!");
    window.location.href = "index.html";
    return;
  }

  try {
    // Live backend se specific product ka data fetch karna
    const response = await fetch(`${BACKEND_URL}/products`);
    const products = await response.json();
    
    // URL wali ID se product match karna
    const product = products.find(p => (p._id || p.id) === productId);

    if (!product) {
      alert("Product database me nahi mila bhaa!");
      window.location.href = "index.html";
      return;
    }

    // HTML Elements ko live data se populate karna
    document.querySelector(".product-info h1").innerText = product.name;
    document.querySelector(".product-info h2").innerText = `₹${product.price}`;
    document.querySelector(".product-image img").src = product.image || "https://via.placeholder.com/500";
    document.querySelector(".product-image img").alt = product.name;
    
    if (product.description) {
      document.querySelector(".product-info p").innerText = product.description;
    } else {
      document.querySelector(".product-info p").innerText = "ANANTMART Premium and authentic quality handcrafted product.";
    }

    // Add to Cart button par event listener lagana
    const addToCartBtn = document.getElementById("addToCart");
    addToCartBtn.onclick = () => addThisToCart(productId);

  } catch (error) {
    console.error("Product details load karne me error:", error);
    alert("Backend server se connect nahi ho paya bhaa!");
  }
}

// SECURE ADD TO CART FUNCTION
async function addThisToCart(prodId) {
  const token = localStorage.getItem("anantmart_token");
  const qty = document.querySelector(".quantity input").value || 1;

  if (!token) {
    alert("Please login first to add items to your cart!");
    window.location.href = "login.html";
    return;
  }

  const cartData = {
    productId: prodId,
    quantity: Number(qty)
  };

  try {
    const response = await fetch(`${BACKEND_URL}/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authorization": token 
      },
      body: JSON.stringify(cartData)
    });

    if (response.status === 201 || response.status === 200) {
      alert("Item added to cart successfully! 🛒");
    } else {
      const result = await response.json();
      alert("Error: " + result.message);
    }
  } catch (error) {
    console.error("Cart error:", error);
    alert("Server issue! Cart me add nahi ho paya.");
  }
}

// Page load hote hi function trigger karna
document.addEventListener("DOMContentLoaded", loadProductDetails);