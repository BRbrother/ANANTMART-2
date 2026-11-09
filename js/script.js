/* =====================================================
   GRAM MART — MAIN JAVASCRIPT
   Supabase | Products | Search | Cart | Authentication
===================================================== */

let allProductsArray = [];


/* ================= HTML SECURITY ================= */

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


/* ================= CATEGORY SLUG ================= */

function slugifyCategory(value = "") {
    return String(value)
        .toLowerCase()
        .trim()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}


/* ================= NOTIFICATION ================= */

function showGramMartToast(message, type = "success") {

    let toast = document.getElementById("gmToast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "gmToast";
        toast.className = "gm-toast";

        toast.setAttribute("role", "status");

        document.body.appendChild(toast);

    }

    toast.textContent = message;
    toast.dataset.type = type;

    toast.classList.add("is-visible");

    clearTimeout(showGramMartToast.timer);

    showGramMartToast.timer = setTimeout(() => {

        toast.classList.remove("is-visible");

    }, 2600);

}


/* ================= LOAD PRODUCTS ================= */

async function loadProducts() {

    const grid = document.getElementById("productGrid");

    if (!grid) return;

    grid.innerHTML = `
        <div class="gm-loading">
            Loading fresh products for you...
        </div>
    `;

    if (!window.supabaseClient) {

        grid.innerHTML = `
            <p class="gm-no-products">
                Store connection nahi ho paaya.
                Please page refresh karo.
            </p>
        `;

        console.error(
            "Supabase client is not available. Check js/supabase.js load order."
        );

        return;
    }

    const { data, error } = await window.supabaseClient
        .from("products")
        .select("id, name, description, price, image_url, category, stock")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (error) {

        console.error("Products load error:", error.message);

        grid.innerHTML = `
            <p class="gm-no-products">
                Products load nahi ho paaye.
                Please try again.
            </p>
        `;

        return;
    }

    allProductsArray = data || [];

    displayProducts(allProductsArray);

}


/* ================= PRODUCT CARD ================= */

function createProductCard(product) {

    const id = escapeHTML(product.id);

    const name = escapeHTML(
        product.name || "Grocery Product"
    );

    const image = escapeHTML(
        product.image_url || ""
    );

    const price = Number(product.price || 0).toFixed(2);

    const outOfStock = Number(product.stock) <= 0;

    const productUrl =
        `product.html?id=${encodeURIComponent(product.id)}`;

    return `

        <article class="product-card">

            <a
                href="${productUrl}"
                class="gm-product-image-link"
                aria-label="View ${name}"
            >

                <img
                    src="${image || "https://placehold.co/300x300?text=Gram+Mart"}"
                    alt="${name}"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='https://placehold.co/300x300?text=Product';"
                >

            </a>


            <div class="gm-product-card-body">

                <h3>${name}</h3>

                <p class="gm-product-price">
                    ₹${price}
                </p>

                <button
                    type="button"
                    data-product-id="${id}"
                    class="add-cart-btn"
                    ${outOfStock ? "disabled" : ""}
                >

                    ${outOfStock ? "Out of Stock" : "＋ Add to Cart"}

                </button>


                <a
                    href="${productUrl}"
                    class="gm-view-product"
                >
                    View Details
                </a>

            </div>

        </article>

    `;

}


/* ================= DISPLAY PRODUCTS ================= */

function displayProducts(products) {

    const grid = document.getElementById("productGrid");

    if (!grid) return;

    const searchInput = document.getElementById("searchInput");

    const query = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";


    /* SEARCH RESULTS */

    if (query) {

        const filtered = products.filter(product =>

            `${product.name || ""} ${product.category || ""} ${product.description || ""}`
                .toLowerCase()
                .includes(query)

        );

        grid.className = "product-grid gm-search-results";

        grid.innerHTML = filtered.length

            ? filtered.map(createProductCard).join("")

            : `
                <p class="gm-no-products">
                    Koi matching product nahi mila.
                    Dusra naam search karke dekho.
                </p>
            `;

        attachCartEvents(grid);

        return;
    }


    /* NO PRODUCTS */

    if (!products.length) {

        grid.className = "product-grid";

        grid.innerHTML = `
            <p class="gm-no-products">
                Abhi koi product available nahi hai.
            </p>
        `;

        return;
    }


    /* GROUP PRODUCTS BY CATEGORY */

    const grouped = {};

    products.forEach(product => {

        const category =
            (product.category || "Other Products").trim();

        if (!grouped[category]) {

            grouped[category] = [];

        }

        grouped[category].push(product);

    });


    const categories = Object.keys(grouped).sort(
        (a, b) => a.localeCompare(b)
    );


    /* CATEGORY SLIDERS */

    grid.className = "gm-category-sections";

    grid.innerHTML = categories.map((category, index) => {

        const categoryProducts = grouped[category];

        const slug = slugifyCategory(category);

        return `

            <section class="gm-category-section">

                <div class="gm-category-heading">

                    <div>

                        <span class="gm-category-label">
                            SHOP BY CATEGORY
                        </span>

                        <h2>
                            ${escapeHTML(category)}
                        </h2>

                        <p>
                            ${categoryProducts.length} products available
                        </p>

                    </div>


                    <a
                        href="category.html?cat=${encodeURIComponent(slug)}"
                        class="gm-view-all"
                    >

                        View All
                        <span aria-hidden="true">→</span>

                    </a>

                </div>


                <div class="gm-slider-wrapper">

                    <button
                        type="button"
                        class="gm-slider-arrow gm-slider-prev"
                        aria-label="Previous products"
                        data-slider="gm-slider-${index}"
                    >
                        ‹
                    </button>


                    <div
                        class="gm-product-slider"
                        id="gm-slider-${index}"
                    >

                        ${categoryProducts.map(createProductCard).join("")}

                    </div>


                    <button
                        type="button"
                        class="gm-slider-arrow gm-slider-next"
                        aria-label="Next products"
                        data-slider="gm-slider-${index}"
                    >
                        ›
                    </button>

                </div>

            </section>

        `;

    }).join("");


    attachCartEvents(grid);

    attachSliderEvents(grid);

}


/* ================= ADD TO CART BUTTON EVENTS ================= */

function attachCartEvents(container) {

    container.querySelectorAll(".add-cart-btn").forEach(button => {

        button.addEventListener("click", async () => {

            if (button.disabled) return;

            const originalText = button.textContent;

            button.disabled = true;

            button.textContent = "Adding...";

            try {

                await addToCart(button.dataset.productId);

            } finally {

                if (
                    document.body.contains(button) &&
                    button.textContent === "Adding..."
                ) {

                    button.disabled = false;

                    button.textContent = originalText;

                }

            }

        });

    });

}


/* ================= PRODUCT SLIDER EVENTS ================= */

function attachSliderEvents(container) {

    container.querySelectorAll(".gm-slider-arrow").forEach(button => {

        button.addEventListener("click", () => {

            const slider = document.getElementById(
                button.dataset.slider
            );

            if (!slider) return;

            const direction = button.classList.contains(
                "gm-slider-next"
            ) ? 1 : -1;

            slider.scrollBy({

                left: direction * slider.clientWidth * 0.82,

                behavior: "smooth"

            });

        });

    });

}


/* ================= ADD TO CART FUNCTION ================= */

async function addToCart(productId) {

    if (!window.supabaseClient) {

        showGramMartToast(
            "Store connection unavailable.",
            "error"
        );

        return;

    }


    /* CHECK LOGIN */

    const {
        data: { user },
        error: authError
    } = await window.supabaseClient.auth.getUser();


    if (authError || !user) {

        showGramMartToast(
            "Cart use karne ke liye pehle login karo.",
            "error"
        );

        window.location.href = "login.html";

        return;

    }


    /* CHECK PRODUCT */

    const product = allProductsArray.find(
        p => String(p.id) === String(productId)
    );


    if (!product || Number(product.stock) < 1) {

        showGramMartToast(
            "Ye product abhi stock mein nahi hai.",
            "error"
        );

        return;

    }


    /* CHECK EXISTING CART ITEM */

    const { data: existing, error: readError } =
        await window.supabaseClient

            .from("cart_items")

            .select("id, quantity")

            .eq("user_id", user.id)

            .eq("product_id", productId)

            .maybeSingle();


    if (readError) {

        console.error(readError);

        showGramMartToast(
            "Cart check nahi ho paaya.",
            "error"
        );

        return;

    }


    /* UPDATE OR INSERT */

    let result;

    if (existing) {

        if (existing.quantity >= product.stock) {

            showGramMartToast(
                "Available stock se zyada quantity add nahi kar sakte.",
                "error"
            );

            return;

        }

        result = await window.supabaseClient

            .from("cart_items")

            .update({
                quantity: existing.quantity + 1
            })

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

        showGramMartToast(
            "Item add nahi hua. Please dobara try karo.",
            "error"
        );

        return;

    }


    showGramMartToast(
        "Product cart mein add ho gaya! 🛒"
    );

}


/* ================= SEARCH ================= */

const searchInput = document.getElementById("searchInput");

if (searchInput) {

    searchInput.addEventListener("input", () => {

        displayProducts(allProductsArray);

    });

}


/* ================= HEADER AUTHENTICATION ================= */

async function updateHeaderAuth() {

    if (!window.supabaseClient) return;


    const {
        data: { user },
        error
    } = await window.supabaseClient.auth.getUser();


    if (error) {

        console.warn(
            "Auth status check:",
            error.message
        );

    }


    const welcome = document.getElementById("welcomeUser");

    const login = document.getElementById("loginlink");

    const logout = document.getElementById("logoutBtn");


    /* LOGGED IN USER */

    if (welcome) {

        welcome.textContent = user

            ? `👤 ${user.user_metadata?.full_name || user.email}`

            : "";

        welcome.style.display = user
            ? "inline-block"
            : "none";

    }


    /* LOGIN LINK */

    if (login) {

        login.style.display = user
            ? "none"
            : "inline-block";

    }


    /* LOGOUT BUTTON */

    if (logout) {

        logout.style.display = user
            ? "inline-block"
            : "none";


        logout.onclick = async () => {

            const {
                error: signOutError
            } = await window.supabaseClient.auth.signOut();


            if (signOutError) {

                showGramMartToast(
                    "Logout nahi ho paaya. Dobara try karo.",
                    "error"
                );

                return;

            }


            window.location.href = "index.html";

        };

    }

}


/* ================= INITIALIZE HOMEPAGE ================= */

document.addEventListener("DOMContentLoaded", () => {

    updateHeaderAuth();

    loadProducts();

});