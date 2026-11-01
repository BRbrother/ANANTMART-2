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

// Category name ko URL-friendly slug banana
function slugifyCategory(value = "") {
    return String(value)
        .toLowerCase()
        .trim()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

// Load all active products
async function loadProducts() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    grid.innerHTML = "<p>Loading products...</p>";

    const { data, error } = await window.supabaseClient
        .from("products")
        .select("id, name, description, price, image_url, category, stock")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Products load error:", error.message);
        grid.innerHTML = "<p>Products load nahi ho paaye. Please try again.</p>";
        return;
    }

    allProductsArray = data || [];
    displayProducts(allProductsArray);
}

// Product card HTML
function createProductCard(product) {
    const id = escapeHTML(product.id);
    const name = escapeHTML(product.name);
    const image = escapeHTML(product.image_url || "");
    const price = Number(product.price || 0).toFixed(2);
    const outOfStock = Number(product.stock) <= 0;

    return `
        <div class="product-card">
            <a href="product.html?id=${encodeURIComponent(product.id)}" class="gm-product-image-link">
                <img
                    src="${image || "https://placehold.co/300x300?text=Gram+Mart"}"
                    alt="${name}"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='https://placehold.co/300x300?text=Product';"
                >
            </a>

            <h3>${name}</h3>

            <p class="gm-product-price">₹${price}</p>

            <button
                type="button"
                data-product-id="${id}"
                class="add-cart-btn"
                ${outOfStock ? "disabled" : ""}
            >
                ${outOfStock ? "Out of Stock" : "Add to Cart 🛒"}
            </button>

            <a href="product.html?id=${encodeURIComponent(product.id)}" class="gm-view-product">
                View Product
            </a>
        </div>
    `;
}

// Homepage category-wise product display
function displayProducts(products) {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    // Search results: show matching products in one grid
    const searchInput = document.getElementById("searchInput");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    if (query) {
        const filtered = products.filter(product =>
            `${product.name} ${product.category || ""} ${product.description || ""}`
                .toLowerCase()
                .includes(query)
        );

        grid.className = "product-grid";
        grid.innerHTML = filtered.length
            ? filtered.map(createProductCard).join("")
            : `<p class="gm-no-products">Koi matching product nahi mila.</p>`;

        attachCartEvents(grid);
        return;
    }

    if (!products.length) {
        grid.innerHTML = `<p class="gm-no-products">Abhi koi product available nahi hai.</p>`;
        return;
    }

    // Group products by actual database category
    const grouped = {};

    products.forEach(product => {
        const category = (product.category || "Other Products").trim();

        if (!grouped[category]) {
            grouped[category] = [];
        }

        grouped[category].push(product);
    });

    const categories = Object.keys(grouped).sort((a, b) =>
        a.localeCompare(b)
    );

    grid.className = "gm-category-sections";

    grid.innerHTML = categories.map((category, index) => {
        const categoryProducts = grouped[category];
        const slug = slugifyCategory(category);

        return `
            <section class="gm-category-section">
                <div class="gm-category-heading">
                    <div>
                        <span class="gm-category-label">SHOP BY CATEGORY</span>
                        <h2>${escapeHTML(category)}</h2>
                        <p>${categoryProducts.length} products available</p>
                    </div>

                    <a
                        href="category.html?cat=${encodeURIComponent(slug)}"
                        class="gm-view-all"
                    >
                        View All →
                    </a>
                </div>

                <div class="gm-slider-wrapper">
                    <button
                        type="button"
                        class="gm-slider-arrow gm-slider-prev"
                        aria-label="Previous products"
                        data-slider="gm-slider-${index}"
                    >
                        &#10094;
                    </button>

                    <div class="gm-product-slider" id="gm-slider-${index}">
                        ${categoryProducts.map(createProductCard).join("")}
                    </div>

                    <button
                        type="button"
                        class="gm-slider-arrow gm-slider-next"
                        aria-label="Next products"
                        data-slider="gm-slider-${index}"
                    >
                        &#10095;
                    </button>
                </div>
            </section>
        `;
    }).join("");

    attachCartEvents(grid);
    attachSliderEvents(grid);
}

// Attach add-to-cart events
function attachCartEvents(container) {
    container.querySelectorAll(".add-cart-btn").forEach(button => {
        button.addEventListener("click", () => {
            addToCart(button.dataset.productId);
        });
    });
}

// Desktop slider arrow functionality
function attachSliderEvents(container) {
    container.querySelectorAll(".gm-slider-arrow").forEach(button => {
        button.addEventListener("click", () => {
            const slider = document.getElementById(button.dataset.slider);
            if (!slider) return;

            const direction = button.classList.contains("gm-slider-next")
                ? 1
                : -1;

            slider.scrollBy({
                left: direction * slider.clientWidth * 0.8,
                behavior: "smooth"
            });
        });
    });
}

// Add product to cart
async function addToCart(productId) {
    const {
        data: { user },
        error: authError
    } = await window.supabaseClient.auth.getUser();

    if (authError || !user) {
        alert("Cart use karne ke liye pehle login karo.");
        window.location.href = "login.html";
        return;
    }

    const product = allProductsArray.find(
        p => String(p.id) === String(productId)
    );

    if (!product || Number(product.stock) < 1) {
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

// Homepage search
const searchInput = document.getElementById("searchInput");

if (searchInput) {
    searchInput.addEventListener("input", () => {
        displayProducts(allProductsArray);
    });
}

// Header login/logout
async function updateHeaderAuth() {
    const {
        data: { user }
    } = await window.supabaseClient.auth.getUser();

    const welcome = document.getElementById("welcomeUser");
    const login = document.getElementById("loginlink");
    const logout = document.getElementById("logoutBtn");

    if (welcome) {
        welcome.textContent = user
            ? `👤 ${user.user_metadata?.full_name || user.email}`
            : "";

        welcome.style.display = user ? "inline-block" : "none";
    }

    if (login) {
        login.style.display = user ? "none" : "inline-block";
    }

    if (logout) {
        logout.style.display = user ? "inline-block" : "none";

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