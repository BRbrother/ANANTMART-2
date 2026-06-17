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
      <div class="product-card">
        <h3>${product.name}</h3>
        <p>₹${product.price}</p>
        <button onclick="addToCart('${realProductId}')">Add to Cart 🛒</button>
        <button class="buy-now-btn">Buy Now</button>
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