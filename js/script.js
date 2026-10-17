let allProductsArray = [];

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function loadProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  grid.textContent = "Loading products...";

  const { data, error } = await window.supabaseClient
    .from("products")
    .select("id, name, description, price, image_url, category, stock")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Products load error:", error.message);
    grid.textContent = "Products load nahi ho paaye. Please try again.";
    return;
  }

  allProductsArray = data || [];
  displayProducts(allProductsArray);
}

function displayProducts(products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  if (!products.length) {
    grid.textContent = "Abhi koi product available nahi hai.";
    return;
  }

  grid.innerHTML = products.map(product => {
    const id = escapeHTML(product.id);
    const name = escapeHTML(product.name);
    const image = escapeHTML(product.image_url || "");
    const price = Number(product.price).toFixed(2);
    const outOfStock = Number(product.stock) <= 0;

    return `
      <div class="product-card">
        <img
          src="${image || "https://placehold.co/300x300?text=Anantmart"}"
          alt="${name}"
          loading="lazy"
          style="width:100%;max-height:220px;object-fit:contain;"
          onerror="this.onerror=null;this.src='https://placehold.co/300x300?text=Product';"
        >
        <h3>${name}</h3>
        <p>₹${price}</p>
        <button
          type="button"
          data-product-id="${id}"
          class="add-cart-btn"
          ${outOfStock ? "disabled" : ""}
        >
          ${outOfStock ? "Out of Stock" : "Add to Cart 🛒"}
        </button>
        <a href="product.html?id=${encodeURIComponent(product.id)}">
          View Product
        </a>
      </div>
    `;
  }).join("");

  grid.querySelectorAll(".add-cart-btn").forEach(button => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.productId);
    });
  });
}

async function addToCart(productId) {
  const { data: { user }, error: authError } =
    await window.supabaseClient.auth.getUser();

  if (authError || !user) {
    alert("Cart use karne ke liye pehle login karo.");
    window.location.href = "login.html";
    return;
  }

  const product = allProductsArray.find(p => p.id === productId);

  if (!product || product.stock < 1) {
    alert("Ye product abhi stock mein nahi hai.");
    return;
  }

  const { data: existing, error: readError } = await window.supabaseClient
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (readError) {
    console.error(readError);
    alert("Cart check nahi ho paaya.");
    return;
  }

  let result;

  if (existing) {
    if (existing.quantity >= product.stock) {
      alert("Available stock se zyada quantity add nahi kar sakte.");
      return;
    }

    result = await window.supabaseClient
      .from("cart_items")
      .update({ quantity: existing.quantity + 1 })
      .eq("id", existing.id);
  } else {
    result = await window.supabaseClient
      .from("cart_items")
      .insert({
        user_id: user.id,
        product_id: productId,
        quantity: 1
      });
  }

  if (result.error) {
    console.error("Cart error:", result.error);
    alert("Item add nahi hua. Please dobara try karo.");
    return;
  }

  alert("Product cart mein add ho gaya! 🛒");
}

const searchInput = document.getElementById("searchInput");

if (searchInput) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    displayProducts(
      allProductsArray.filter(product =>
        `${product.name} ${product.category || ""}`
          .toLowerCase()
          .includes(query)
      )
    );
  });
}

async function updateHeaderAuth() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();

  const welcome = document.getElementById("welcomeUser");
  const login = document.getElementById("loginlink");
  const logout = document.getElementById("logoutBtn");

  if (welcome) {
    welcome.textContent = user
      ? `👤 ${user.user_metadata?.full_name || user.email}`
      : "";
    welcome.style.display = user ? "inline-block" : "none";
  }

  if (login) login.style.display = user ? "none" : "inline-block";
  if (logout) logout.style.display = user ? "inline-block" : "none";

  if (logout) {
    logout.onclick = async () => {
      const { error } = await window.supabaseClient.auth.signOut();

      if (error) {
        alert("Logout nahi ho paaya. Dobara try karo.");
        return;
      }

      window.location.href = "index.html";
    };
  }
}

updateHeaderAuth();
loadProducts();