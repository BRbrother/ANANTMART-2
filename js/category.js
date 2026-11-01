let categoryProducts = [];
let currentCategory = "";

const categoryGrid = document.getElementById("categoryProductGrid");
const categorySearch = document.getElementById("categorySearch");
const productCount = document.getElementById("productCount");

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function slugifyCategory(value = "") {
    return String(value)
        .toLowerCase()
        .trim()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

// Find category using URL slug or exact category name
async function loadCategoryProducts() {
    if (!categoryGrid) return;

    categoryGrid.innerHTML = "<p>Loading products...</p>";

    const params = new URLSearchParams(window.location.search);
    const requestedCategory = params.get("cat");

    if (!requestedCategory) {
        showCategoryError("Category select nahi ki gayi.");
        return;
    }

    const { data, error } = await window.supabaseClient
        .from("products")
        .select("id, name, description, price, image_url, category, stock")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        showCategoryError("Products load nahi ho paaye.");
        return;
    }

    const allProducts = data || [];

    const matchedCategory = allProducts.find(product =>
        slugifyCategory(product.category) === slugifyCategory(requestedCategory)
    );

    if (!matchedCategory) {
        showCategoryError("Ye category nahi mili ya isme abhi products available nahi hain.");
        return;
    }

    currentCategory = matchedCategory.category;

    categoryProducts = allProducts.filter(product =>
        product.category === currentCategory
    );

    document.title = `${currentCategory} | Gram Mart`;

    const title = document.getElementById("categoryTitle");
    const description = document.getElementById("categoryDescription");
    const breadcrumb = document.getElementById("breadcrumbCategory");

    if (title) title.textContent = currentCategory;

    if (description) {
        description.textContent =
            `Gram Mart par ${currentCategory} ke quality products ghar baithe order karein.`;
    }

    if (breadcrumb) {
        breadcrumb.innerHTML = `
            <a href="index.html">Home</a>
            <span>›</span>
            <span>${escapeHTML(currentCategory)}</span>
        `;
    }

    displayCategoryProducts(categoryProducts);
}

function showCategoryError(message) {
    categoryGrid.innerHTML = `
        <div class="category-empty">
            <h3>${escapeHTML(message)}</h3>
            <a href="index.html">Back to Home</a>
        </div>
    `;

    if (productCount) productCount.textContent = "0 products";
}

// Create product card
function createCategoryProductCard(product) {
    const id = escapeHTML(product.id);
    const name = escapeHTML(product.name);
    const image = escapeHTML(product.image_url || "");
    const price = Number(product.price || 0).toFixed(2);
    const outOfStock = Number(product.stock) <= 0;

    return `
        <div class="category-product-card">
            <a
                href="product.html?id=${encodeURIComponent(product.id)}"
                class="category-product-image-link"
            >
                <img
                    src="${image || "https://placehold.co/300x300?text=Gram+Mart"}"
                    alt="${name}"
                    class="category-product-image"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='https://placehold.co/300x300?text=Product';"
                >
            </a>

            <h3 class="category-product-name">${name}</h3>

            <p class="category-product-price">₹${price}</p>

            <div class="category-product-actions">
                <button
                    type="button"
                    class="category-add-btn"
                    data-product-id="${id}"
                    ${outOfStock ? "disabled" : ""}
                >
                    ${outOfStock ? "Out of Stock" : "Add to Cart 🛒"}
                </button>

                <a
                    href="product.html?id=${encodeURIComponent(product.id)}"
                    class="category-view-btn"
                >
                    View Product
                </a>
            </div>
        </div>
    `;
}

// Display and search products
function displayCategoryProducts(products) {
    if (!categoryGrid) return;

    const query = categorySearch
        ? categorySearch.value.trim().toLowerCase()
        : "";

    const filteredProducts = products.filter(product =>
        `${product.name} ${product.description || ""} ${product.category || ""}`
            .toLowerCase()
            .includes(query)
    );

    if (productCount) {
        productCount.textContent =
            `${filteredProducts.length} products`;
    }

    if (!filteredProducts.length) {
        categoryGrid.innerHTML = `
            <div class="category-empty">
                <h3>No products found</h3>
                <p>Search change karke dobara try karein.</p>
            </div>
        `;
        return;
    }

    categoryGrid.innerHTML = filteredProducts
        .map(createCategoryProductCard)
        .join("");

    categoryGrid.querySelectorAll(".category-add-btn").forEach(button => {
        button.addEventListener("click", () => {
            addCategoryProductToCart(button.dataset.productId);
        });
    });
}

// Add to cart
async function addCategoryProductToCart(productId) {
    const {
        data: { user },
        error: authError
    } = await window.supabaseClient.auth.getUser();

    if (authError || !user) {
        alert("Cart use karne ke liye pehle login karo.");
        window.location.href = "login.html";
        return;
    }

    const product = categoryProducts.find(
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
        console.error(result.error);
        alert("Item add nahi hua. Dobara try karo.");
        return;
    }

    alert("Product cart mein add ho gaya! 🛒");
}

// Category search
if (categorySearch) {
    categorySearch.addEventListener("input", () => {
        displayCategoryProducts(categoryProducts);
    });
}

loadCategoryProducts();