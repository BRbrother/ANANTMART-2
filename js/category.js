const categoryDefinitions = {
    "fruits-vegetables": {
        name: "Fruits & Vegetables",
        description: "Fresh produce for your everyday meals.",
        dbCategory: "Fruits & Vegetables"
    },
    "dairy-eggs": {
        name: "Dairy & Eggs",
        description: "Everyday dairy essentials for your home.",
        dbCategory: "Dairy & Eggs"
    },
    "atta-rice-dal": {
        name: "Atta, Rice & Dal",
        description: "Stock up on everyday grocery staples.",
        dbCategory: "Atta, Rice & Dal"
    },
    "oil-ghee-masala": {
        name: "Oil, Ghee & Masala",
        description: "Cooking essentials for your kitchen.",
        dbCategory: "Oil, Ghee & Masala"
    },
    "snacks-beverages": {
        name: "Snacks & Beverages",
        description: "Snacks and drinks for every occasion.",
        dbCategory: "Snacks & Beverages"
    },
    "personal-care": {
        name: "Personal Care",
        description: "Daily personal care essentials.",
        dbCategory: "Personal Care"
    },
    "household": {
        name: "Household",
        description: "Useful essentials for a cleaner home.",
        dbCategory: "Household"
    }
};

let categoryProducts = [];

const categoryGrid = document.getElementById("categoryProductGrid");
const categorySearch = document.getElementById("categorySearch");
const productCount = document.getElementById("productCount");

function safeText(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatPrice(price) {
    return Number(price).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    });
}

function showEmpty(message) {
    categoryGrid.innerHTML = "";
    const paragraph = document.createElement("p");
    paragraph.className = "category-empty";
    paragraph.textContent = message;
    categoryGrid.appendChild(paragraph);
    productCount.textContent = "0 products";
}

async function loadCategoryProducts() {
    const slug = new URLSearchParams(window.location.search).get("cat");
    const category = categoryDefinitions[slug];

    if (!category) {
        document.getElementById("categoryTitle").textContent =
            "Category not found";
        document.getElementById("breadcrumbCategory").textContent =
            "Not found";
        document.getElementById("categoryDescription").textContent =
            "Please select a category from the homepage.";
        showEmpty("Please go back and choose a valid category.");
        return;
    }

    document.title = `${category.name} | Gram Mart`;
    document.getElementById("categoryTitle").textContent = category.name;
    document.getElementById("breadcrumbCategory").textContent = category.name;
    document.getElementById("categoryDescription").textContent =
        category.description;

    const client = window.supabaseClient;

    if (!client) {
        showEmpty("Service unavailable. Please refresh and try again.");
        return;
    }

    categoryGrid.textContent = "Loading products...";
    productCount.textContent = "Loading...";

    const { data, error } = await client
        .from("products")
        .select("id, name, description, price, image_url, category, stock")
        .eq("is_active", true)
        .eq("category", category.dbCategory)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Category products error:", error);
        showEmpty("Products load nahi ho paaye. Please try again.");
        return;
    }

    categoryProducts = data || [];
    displayCategoryProducts(categoryProducts);
}

function displayCategoryProducts(products) {
    categoryGrid.innerHTML = "";

    const query = categorySearch.value.trim().toLowerCase();

    const filtered = products.filter(product =>
        `${product.name || ""} ${product.description || ""} ${product.category || ""}`
            .toLowerCase()
            .includes(query)
    );

    productCount.textContent =
        `${filtered.length} product${filtered.length === 1 ? "" : "s"}`;

    if (!filtered.length) {
        showEmpty(
            query
                ? "Is search se koi product nahi mila."
                : "Is category mein abhi koi product available nahi hai."
        );
        return;
    }

    categoryGrid.innerHTML = filtered.map(product => {
        const outOfStock = Number(product.stock) <= 0;
        const image = safeText(
            product.image_url || "https://placehold.co/300x300?text=Gram+Mart"
        );

        return `
            <article class="category-product-card">
                <a
                    class="category-product-image-link"
                    href="product.html?id=${encodeURIComponent(product.id)}"
                    aria-label="View ${safeText(product.name)}">
                    <img
                        class="category-product-image"
                        src="${image}"
                        alt="${safeText(product.name)}"
                        loading="lazy">
                </a>

                <h2 class="category-product-name">
                    ${safeText(product.name)}
                </h2>

                <p class="category-product-price">
                    ${formatPrice(product.price)}
                </p>

                <div class="category-product-actions">
                    <button
                        type="button"
                        class="category-add-btn"
                        data-product-id="${safeText(product.id)}"
                        ${outOfStock ? "disabled" : ""}>
                        ${outOfStock ? "Out of Stock" : "Add to Cart 🛒"}
                    </button>

                    <a
                        class="category-view-btn"
                        href="product.html?id=${encodeURIComponent(product.id)}">
                        View Product
                    </a>
                </div>
            </article>
        `;
    }).join("");

    categoryGrid.querySelectorAll(".category-product-image").forEach(img => {
        img.addEventListener("error", () => {
            img.src = "https://placehold.co/300x300?text=Product";
        }, { once: true });
    });

    categoryGrid.querySelectorAll(".category-add-btn").forEach(button => {
        button.addEventListener("click", () => {
            addCategoryProductToCart(button.dataset.productId, button);
        });
    });
}

async function addCategoryProductToCart(productId, button) {
    const client = window.supabaseClient;

    const { data: { user }, error: authError } =
        await client.auth.getUser();

    if (authError || !user) {
        alert("Cart use karne ke liye pehle login karo.");
        window.location.href = "login.html";
        return;
    }

    const product = categoryProducts.find(item => item.id === productId);

    if (!product || Number(product.stock) < 1) {
        alert("Ye product abhi stock mein nahi hai.");
        return;
    }

    button.disabled = true;

    try {
        const { data: existing, error: readError } = await client
            .from("cart_items")
            .select("id, quantity")
            .eq("user_id", user.id)
            .eq("product_id", productId)
            .maybeSingle();

        if (readError) throw readError;

        let result;

        if (existing) {
            if (Number(existing.quantity) >= Number(product.stock)) {
                alert("Available stock se zyada quantity add nahi kar sakte.");
                return;
            }

            result = await client
                .from("cart_items")
                .update({ quantity: existing.quantity + 1 })
                .eq("id", existing.id)
                .eq("user_id", user.id);
        } else {
            result = await client
                .from("cart_items")
                .insert({
                    user_id: user.id,
                    product_id: productId,
                    quantity: 1
                });
        }

        if (result.error) throw result.error;

        alert("Product cart mein add ho gaya! 🛒");

    } catch (error) {
        console.error("Add to cart error:", error);
        alert("Item add nahi hua. Please dobara try karo.");
    } finally {
        button.disabled = false;
    }
}

categorySearch.addEventListener("input", () => {
    displayCategoryProducts(categoryProducts);
});

loadCategoryProducts();