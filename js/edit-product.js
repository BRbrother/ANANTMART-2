(() => {
"use strict";

const db = window.supabaseClient;

const $ = id => document.getElementById(id);

const status = message => {
    $("status").textContent = message || "";
};

const params = new URLSearchParams(location.search);
const productId = params.get("id");

let variants = [];
let saving = false;


/* =========================
   ADMIN VERIFICATION
========================= */

async function verifyAdmin() {

    if (!db) {
        throw new Error(
            "Supabase client load nahi hua. js/supabase.js check karo."
        );
    }

    const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData.session) {
        location.href = "./login.html";
        return false;
    }

    const { data: isAdmin, error } = await db.rpc("is_admin");

    if (error) throw error;

    if (isAdmin !== true) {
        alert("Sirf admin product edit kar sakta hai.");
        location.href = "./index.html";
        return false;
    }

    return true;
}


/* =========================
   VARIANT MANAGEMENT
========================= */

function renderVariants() {

    const root = $("variants");
    root.replaceChildren();

    if (!variants.length) {
        const message = document.createElement("p");
        message.className = "hint";
        message.textContent = "No variants added.";
        root.appendChild(message);
    }

    variants.forEach((variant, index) => {

        const row = document.createElement("div");
        row.className = "variant-row";

        const fields = [
            ["name", "Variant name", "e.g. Size"],
            ["value", "Variant value", "e.g. 1 kg"],
            ["sku", "Variant SKU", "e.g. GM-1KG"]
        ];

        fields.forEach(([key, label, placeholder]) => {

            const input = document.createElement("input");

            input.value = variant[key] || "";
            input.placeholder = placeholder;
            input.setAttribute("aria-label", label);

            input.addEventListener("input", () => {
                variants[index][key] = input.value;
            });

            row.appendChild(input);
        });

        const remove = document.createElement("button");

        remove.type = "button";
        remove.className = "remove";
        remove.textContent = "Remove";

        remove.addEventListener("click", () => {
            variants.splice(index, 1);
            renderVariants();
        });

        row.appendChild(remove);
        root.appendChild(row);
    });
}

$("addVariant").addEventListener("click", () => {

    variants.push({
        name: "",
        value: "",
        sku: ""
    });

    renderVariants();
});


/* =========================
   IMAGE MANAGEMENT
========================= */

function renderImages(existingImages = []) {

    const root = $("imageSlots");
    root.replaceChildren();

    for (let i = 0; i < 6; i++) {

        const existingUrl = existingImages[i] || "";

        const box = document.createElement("div");
        box.className = "image-slot";

        const title = document.createElement("strong");

        title.textContent =
            `Image ${i + 1}${i === 0 ? " (Main)" : ""}`;

        const url = document.createElement("input");

        url.type = "url";
        url.placeholder = "Paste image URL";
        url.value = existingUrl;

        const file = document.createElement("input");

        file.type = "file";
        file.accept = "image/jpeg,image/png,image/webp,image/avif";

        const preview = document.createElement("div");

        preview.className = "preview";

        function showPreview(src) {

            preview.replaceChildren();

            if (!src) {
                preview.textContent = "No image";
                return;
            }

            const img = document.createElement("img");

            img.src = src;
            img.alt = `Product image ${i + 1}`;

            img.onerror = () => {
                preview.textContent = "Preview unavailable";
            };

            preview.appendChild(img);
        }

        showPreview(existingUrl);

        url.addEventListener("input", () => {

            if (file.files.length) {
                file.value = "";
            }

            showPreview(url.value.trim());
        });

        file.addEventListener("change", () => {

            const selectedFile = file.files[0];

            if (!selectedFile) {
                showPreview(url.value.trim() || existingUrl);
                return;
            }

            if (selectedFile.size > 5 * 1024 * 1024) {

                alert("Har image 5 MB ya usse kam honi chahiye.");

                file.value = "";
                showPreview(url.value.trim() || existingUrl);

                return;
            }

            if (!selectedFile.type.startsWith("image/")) {

                alert("Please ek valid image file select karo.");

                file.value = "";
                return;
            }

            url.value = "";

            showPreview(URL.createObjectURL(selectedFile));
        });

        box.append(title, url, file, preview);
        root.appendChild(box);
    }
}


/* =========================
   LOAD PRODUCT
========================= */

async function loadProduct() {

    if (!productId) {

        throw new Error(
            "Product ID missing hai. Admin panel se Edit button open karo."
        );
    }

    if (!(await verifyAdmin())) return;

    status("Product details load ho rahi hain...");

    const { data: product, error } = await db
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

    if (error) throw error;

    // Basic details
    $("name").value = product.name || "";
    $("description").value = product.description || "";
    $("brand").value = product.brand || "";
    $("sku").value = product.sku || "";
    $("barcode").value = product.barcode || "";
    $("unit").value = product.unit || "";

    // Pricing
    $("mrp").value = product.mrp ?? product.price ?? "";
    $("price").value = product.price ?? "";
    $("stock").value = product.stock ?? 0;
    $("discount").value = product.discount_percent ?? 0;

    // Category
    $("category").value = product.category || "";
    $("subcategory").value = product.subcategory || "";

    // Keywords: support both fields
    const keywords = Array.isArray(product.keywords)
        && product.keywords.length
        ? product.keywords
        : product.tags;

    $("keywords").value = Array.isArray(keywords)
        ? keywords.join(", ")
        : "";

    // Publishing
    $("active").checked = product.is_active === true;
    $("featured").checked = product.is_featured === true;

    // Variants
    variants = Array.isArray(product.variants)
        ? product.variants.map(v => ({
            name: v.name || "",
            value: v.value || "",
            sku: v.sku || ""
        }))
        : [];

    renderVariants();

    // Images
    let images = Array.isArray(product.image_urls)
        ? product.image_urls
        : [];

    // Compatibility with older products
    if (!images.length && product.image_url) {
        images = [product.image_url];
    }

    renderImages(images.filter(Boolean).slice(0, 6));

    calculateDiscount();

    // Allow discount to be explicitly edited
    $("discount").dataset.touched = "";

    status(`Product loaded successfully. ID: ${product.id}`);
}


/* =========================
   DISCOUNT CALCULATION
========================= */

function calculateDiscount() {

    const mrp = Number($("mrp").value);
    const price = Number($("price").value);

    if (
        $("mrp").value !== "" &&
        $("price").value !== "" &&
        mrp > 0 &&
        price <= mrp
    ) {

        const percentage = ((mrp - price) / mrp) * 100;

        $("priceHint").textContent =
            `Customer saving: ₹${(mrp - price).toFixed(2)} ` +
            `(${percentage.toFixed(1)}%)`;

        if (!$("discount").dataset.touched) {
            $("discount").value = percentage.toFixed(2);
        }

    } else {

        $("priceHint").textContent =
            "Selling price should not exceed MRP.";
    }
}

$("mrp").addEventListener("input", calculateDiscount);
$("price").addEventListener("input", calculateDiscount);

$("discount").addEventListener("input", () => {
    $("discount").dataset.touched = "1";
});


/* =========================
   UPLOAD PRODUCT IMAGE
========================= */

async function uploadImage(file) {

    if (file.size > 5 * 1024 * 1024) {
        throw new Error(
            `${file.name}: image 5 MB se badi hai.`
        );
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif"
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error(
            "JPG, PNG, WEBP ya AVIF image use karo."
        );
    }

    const safeName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-");

    const path =
        `products/${crypto.randomUUID()}-${safeName}`;

    const { error } = await db.storage
        .from("gram-mart-products")
        .upload(path, file, {
            upsert: false,
            contentType: file.type
        });

    if (error) throw error;

    const { data } = db.storage
        .from("gram-mart-products")
        .getPublicUrl(path);

    return data.publicUrl;
}


/* =========================
   UPDATE PRODUCT
========================= */

$("editProductForm").addEventListener("submit", async event => {

    event.preventDefault();

    if (saving) return;

    saving = true;

    const button = $("saveBtn");

    button.disabled = true;
    button.textContent = "Updating...";
    status("Product update ho raha hai...");

    try {

        if (!(await verifyAdmin())) return;

        const name = $("name").value.trim();
        const description = $("description").value.trim();
        const category = $("category").value.trim();
        const subcategory = $("subcategory").value.trim();

        const mrp = Number($("mrp").value);
        const price = Number($("price").value);
        const stock = Number($("stock").value);

        // Required fields
        if (!name || !description || !category || !subcategory) {
            throw new Error(
                "Product title, description, category aur sub-category bharna zaroori hai."
            );
        }

        // Price validation
        if (
            !Number.isFinite(mrp) ||
            !Number.isFinite(price) ||
            mrp < 0 ||
            price < 0
        ) {
            throw new Error("Valid MRP aur selling price enter karo.");
        }

        if (price > mrp) {
            throw new Error(
                "Selling price MRP se zyada nahi ho sakta."
            );
        }

        // Stock validation
        if (!Number.isInteger(stock) || stock < 0) {
            throw new Error(
                "Stock 0 ya positive whole number hona chahiye."
            );
        }

        // Discount
        const discount = $("discount").value === ""
            ? (mrp > 0 ? ((mrp - price) / mrp) * 100 : 0)
            : Number($("discount").value);

        if (
            !Number.isFinite(discount) ||
            discount < 0 ||
            discount > 100
        ) {
            throw new Error(
                "Discount 0 se 100% ke beech rakho."
            );
        }

        // Images
        const imageUrls = [];

        const imageSlots = $("imageSlots").children;

        for (const box of imageSlots) {

            const urlInput = box.querySelector('input[type="url"]');
            const fileInput = box.querySelector('input[type="file"]');

            let imageUrl = urlInput.value.trim();

            if (fileInput.files[0]) {
                imageUrl = await uploadImage(fileInput.files[0]);
            }

            if (imageUrl) {

                let parsedUrl;

                try {
                    parsedUrl = new URL(imageUrl);
                } catch {
                    throw new Error(
                        "Product image ka URL valid nahi hai."
                    );
                }

                if (
                    parsedUrl.protocol !== "https:" &&
                    parsedUrl.protocol !== "http:"
                ) {
                    throw new Error(
                        "Image URL HTTP ya HTTPS hona chahiye."
                    );
                }

                imageUrls.push(imageUrl);
            }
        }

        // Keywords
        const tags = $("keywords").value
            .split(",")
            .map(value => value.trim())
            .filter(Boolean);

        // Variants
        const cleanVariants = variants
            .map(v => ({
                name: v.name.trim(),
                value: v.value.trim(),
                sku: v.sku.trim() || null
            }))
            .filter(v => v.name && v.value);

        // Final product data
        const payload = {
            name,
            description,
            price,
            mrp,
            discount_percent: Number(discount.toFixed(2)),
            category,
            subcategory,
            stock,

            brand: $("brand").value.trim() || null,
            sku: $("sku").value.trim() || null,
            barcode: $("barcode").value.trim() || null,
            unit: $("unit").value.trim() || null,

            tags,
            keywords: tags,
            variants: cleanVariants,

            image_urls: imageUrls,
            image_url: imageUrls[0] || null,

            is_active: $("active").checked,
            is_featured: $("featured").checked
        };

        // UPDATE existing row; do NOT insert a new product
        const { data, error } = await db
            .from("products")
            .update(payload)
            .eq("id", productId)
            .select("id")
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            throw new Error(
                "Product update confirm nahi hua. Admin permission aur product ID check karo."
            );
        }

        status("Product successfully updated!");

        alert("Gram Mart product successfully update ho gaya!");

        location.href = "./admin.html";

    } catch (error) {

        console.error("Edit product error:", error);

        status("");

        alert(
            error.message || "Product update nahi ho paya."
        );

    } finally {

        saving = false;

        button.disabled = false;
        button.textContent = "Update Product";
    }
});


/* =========================
   INITIALIZE PAGE
========================= */

loadProduct().catch(error => {

    console.error("Product load error:", error);

    status("");

    alert(
        "Product load nahi hua: " +
        (error.message || error)
    );
});

})();