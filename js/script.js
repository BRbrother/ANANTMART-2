// Global array taaki search filter sahi se kaam kare
let allProductsArray = []; 

// MASTER URL: Pure file ke liye ek hi baar live link set kar diya
const BACKEND_URL = "https://anantmart-backend.onrender.com";

// =======================================================
// 1. PRODUCTS SCREEN PAR DIKHANA (SAFE ID RESOLUTION)
// =======================================================
function displayProducts(products) {
  const productGrid = document.getElementById("productGrid");
  if (!productGrid) return;

  productGrid.innerHTML = ""; // Purani grid saaf karna

  products.forEach(product => {
    // SECURITY CHECK: NeDB database me real automatic ID '_id' hoti hai
    const realProductId = product._id || product.id;

    console.log(`Product Name: ${product.name} -> Resolved ID:`, realProductId);

    productGrid.innerHTML += `
      <div class="product-card" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; background: #fff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <img src="${product.image || 'https://via.placeholder.com/150'}" alt="${product.name}" style="width: 100%; height: auto; border-radius: 4px; margin-bottom: 12px;">
        <h3 style="margin: 10px 0; font-size: 18px; color: #1e293b;">${product.name}</h3>
        <p style="font-size: 16px; font-weight: bold; color: #ea580c; margin-bottom: 15px;">₹${product.price}</p>

        <div class="product-actions" style="display: flex; flex-direction: column; gap: 8px; ">
        <button onclick="addToCart('${realProductId}')" style="background: #ea580c; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%;">
        Add to Cart 🛒
        </button>
        <a href="product.html?id=${realProductId}" style="text-decoration: none; background: #1e293b; color: white; padding: 10px; border-radius: 6px; font-weight: bold; text-align: center; display: block; width: 100%;">
          Buy Now
        </a>
      </div>
      </div>
    `;
  });
}

// Backend se live products load karna
async function loadProducts() {
  try {
    // FIXED: Localhost hata kar global BACKEND_URL lagaya
    const response = await fetch(`${BACKEND_URL}/products`);
    const products = await response.json();
    
    console.log("Raw Backend Products:", products); // Debugging line
    allProductsArray = products; 
    displayProducts(products);
  } catch (error) {
    console.log("Products load karne me dikkat:", error);
  }
}

loadProducts();

// =======================================================
// 2. SECURE ADD TO CART FUNCTION 
// =======================================================
async function addToCart(productId) {
  const token = localStorage.getItem("anantmart_token");

  if (!token) {
    alert("Please login first to add items to your cart!");
    window.location.href = "login.html";
    return;
  }

  console.log("Sending to Backend ProductId:", productId);

  const cartData = {
    productId: productId,
    quantity: 1
  };

  try {
    // FIXED: Localhost hata kar global BACKEND_URL lagaya
    const response = await fetch(`${BACKEND_URL}/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authorization": token 
      },
      body: JSON.stringify(cartData)
    });

    const result = await response.json();

    if (response.status === 201 || response.status === 200) {
      alert("Item added to cart successfully! 🛒");
    } else {
      alert("Error: " + result.message);
    }
  } catch (error) {
    console.error("Cart error:", error);
    alert("Server connect nahi ho pa raha hai bhaa!");
  }
}

// =======================================================
// 3. USER WELCOME & LOGOUT LOGIC
// =======================================================
const isLoggedIn = localStorage.getItem("isLoggedIn");
const userEmail = localStorage.getItem("userEmail");

const welcomeUser = document.getElementById("welcomeUser");
const loginLink = document.getElementById("loginlink"); 
const logoutBtn = document.getElementById("logoutBtn");

if (isLoggedIn === "true" && userEmail && welcomeUser && loginLink && logoutBtn) {
  const shortName = userEmail.split("@")[0]; 
  
  welcomeUser.innerHTML = `👤 ${shortName}`;
  welcomeUser.style.display = "inline-block";
  loginLink.style.display = "none";
  logoutBtn.style.display = "inline-block";

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("anantmart_token");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("isLoggedIn");
    
    alert("Logged out successfully!");
    window.location.href = "index.html";
  });
}

// =======================================================
// 4. LIVE SEARCH FILTER
// =======================================================
const searchInput = document.getElementById("searchInput");

if (searchInput) {
  searchInput.addEventListener("keyup", () => {
    const searchText = searchInput.value.toLowerCase();
    
    const filteredProducts = allProductsArray.filter(product =>
      product.name.toLowerCase().includes(searchText)
    );

    displayProducts(filteredProducts);
  });
}