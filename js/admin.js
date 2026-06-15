// =======================================================
// ANANTMART - PRODUCTION READY COMPLETE ADMIN LOGIC (DAY 16)
// =======================================================

// -------------------------------------------------------
// 1. PRODUCTS SCREEN PAR DIKHANA (GET REQUEST)
// -------------------------------------------------------
async function loadProducts() {
  const adminProducts = document.getElementById("adminProducts");
  if (!adminProducts) return;

  try {
    const response = await fetch("http://localhost:3000/products");
    const products = await response.json();

    adminProducts.innerHTML = ""; // Purani list saaf karna

    products.forEach((product) => {
      // SAFE FALLBACK: Agar image URL missing hai, toh default placeholder image lagao
      const productImage = product.image || "https://via.placeholder.com/150";
      const productCat = product.category || 'N/A';
      const productStock = product.stock || '0';
      
      // NeDB ki automatic real ID ALWAYS '_id' hoti hai
      const realId = product._id || product.id;

      // ANANTMART Premium Grid Card Layout Style
      adminProducts.innerHTML += `
        <div class="admin-product">
          <img src="${productImage}" alt="${product.name}">
          <h3>${product.name}</h3>
          <p>₹${product.price}</p>
          <p style="font-size: 12px; color: #666; margin: 2px 0;">Cat: ${productCat}</p>
          <p style="font-size: 12px; color: #666; margin: 2px 0;">Stock: ${productStock}</p>
          <div class="action-btns" style="display: flex; gap: 5px; justify-content: center; margin-top: 10px;">
            <button class="edit-btn" onclick="editProduct('${realId}')" style="background:#2563EB; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px;">Edit</button>
            <button class="delete-btn" onclick="deleteProduct('${realId}')" style="background:#FFFFFF; color:#DC2626; border:1px solid #FCA5A5; padding:5px 10px; cursor:pointer; border-radius:4px;">Delete</button>
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error("Products load karne me dikkat aayi:", error);
    adminProducts.innerHTML = "<p style='color:red; text-align:center;'>Backend server connect nahi hai ya band hai!</p>";
  }
}

// -------------------------------------------------------
// 2. PRODUCT ADD KARNA (POST REQUEST)
// -------------------------------------------------------
async function addProduct() {
  const name = document.getElementById("productName").value;
  const price = document.getElementById("productPrice").value;
  const category = document.getElementById("productCategory").value;
  const stock = document.getElementById("productStock").value;
  const image = document.getElementById("productImage").value;

  if (!name || !price || !image) {
    alert("Bhai, Product Name, Price aur Image URL bharna jaroori hai!");
    return;
  }

  const productData = {
    name: name,
    price: Number(price),
    category: category,
    stock: Number(stock || 0),
    image: image
  };

  try {
    const response = await fetch("http://localhost:3000/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(productData)
    });

    const result = await response.json();

    if (response.status === 201 || response.status === 200) {
      alert("🎉 Product Added to ANANTMART Store Successfully!");
      
      loadProducts(); // Fresh list update
      
      // Form fields ko wapas khali karna
      document.getElementById("productName").value = "";
      document.getElementById("productPrice").value = "";
      document.getElementById("productCategory").value = "";
      document.getElementById("productStock").value = "";
      document.getElementById("productImage").value = "";
    } else {
      alert("Server Error: " + result.message);
    }
  } catch (error) {
    console.error("Backend se connect nahi ho paya:", error);
    alert("Server band hai! Pehle terminal me server.js run karo.");
  }
}

// -------------------------------------------------------
// 3. PRODUCT EDIT KARNA (PUT REQUEST)
// -------------------------------------------------------
async function editProduct(id) {
  const newName = prompt("Naya Product Name daalein:");
  const newPrice = prompt("Naya Product Price daalein:");

  if (!newName && !newPrice) {
    alert("Kuch bhi badlaav nahi kiya gya bhai!");
    return;
  }

  const updatedData = {};
  if (newName) updatedData.name = newName;
  if (newPrice) updatedData.price = Number(newPrice);

  try {
    const response = await fetch(`http://localhost:3000/products/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updatedData)
    });

    const result = await response.json();

    if (response.status === 200) {
      alert("🔄 Updated Successfully!");
      loadProducts(); 
    } else {
      alert("Error: " + result.message);
    }
  } catch (error) {
    console.error("Update karne me error aaya:", error);
    alert("Server connect nahi ho paya!");
  }
}

// -------------------------------------------------------
// 4. PRODUCT DELETE KARNA (DELETE REQUEST)
// -------------------------------------------------------
async function deleteProduct(id) {
  if (!confirm("Kya aap sach me ye product ANANTMART se hatana chahte hain?")) {
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/products/${id}`, {
      method: "DELETE"
    });

    const result = await response.json();

    if (response.status === 200) {
      alert("🗑️ Deleted Successfully!");
      loadProducts(); 
    } else {
      alert("Error: " + result.message);
    }
  } catch (error) {
    console.error("Delete request fail ho gayi:", error);
    alert("Server connect nahi ho paya!");
  }
}

// -------------------------------------------------------
// 5. LIVE COUNTER WIDGETS & CUSTOMER ORDERS TABLE LOAD
// -------------------------------------------------------
async function loadAdminStatsAndOrders() {
  try {
    const response = await fetch("http://localhost:3000/admin/stats");
    const data = await response.json();

    // Top Row Cards Widgets Update
    if (document.getElementById("revenueWidget")) document.getElementById("revenueWidget").innerText = data.totalRevenue || 0;
    if (document.getElementById("ordersWidget")) document.getElementById("ordersWidget").innerText = data.totalOrders || 0;
    if (document.getElementById("usersWidget")) document.getElementById("usersWidget").innerText = data.totalUsers || 0;

    const tableBody = document.getElementById("adminOrderTableBody");
    if (!tableBody) return;
    tableBody.innerHTML = ""; 

    if (!data.ordersList || data.ordersList.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px; color:#666;'>Abhi tak koi order nahi aaya hai. 📭</td></tr>";
      return;
    }

    data.ordersList.forEach(order => {
      const itemsString = order.items ? order.items.map(item => `${item.name} (${item.quantity})`).join(", ") : "N/A";

      tableBody.innerHTML += `
        <tr>
          <td style="font-family: monospace; color: #666; font-size:12px;">${order._id || order.id}</td>
          <td><b>${order.email}</b></td>
          <td>${itemsString}</td>
          <td style="color: #F97316; font-weight: bold;">₹${order.totalAmount}</td>
          <td style="font-size: 13px; color: #555;">${order.orderDate || 'Recent'}</td>
          <td><span class="status-badge" style="background: #2563EB; color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px;">${order.status || "Pending"}</span></td>
        </tr>
      `;
    });

  } catch (error) {
    console.error("Admin details render block failed:", error);
  }
}

// -------------------------------------------------------
// 6. DOM RENDER LOGIC TRIGGER ON LOAD
// -------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  loadAdminStatsAndOrders();
});