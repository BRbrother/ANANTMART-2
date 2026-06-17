const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "AnantMart_Super_Secret_Key_2026";

// =======================================================
// 1. SUPABASE CLOUD CONNECTION
// =======================================================
const SUPABASE_URL = "https://ofqoapfhhqosvbzeboap.supabase.co";
// Render ke Environment Variables me SUPABASE_KEY daalna best hai, nahi toh abhi ke liye apni anon key yahan paste kar do:
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_mRdMBPgdLJo8IOVJUAyLAQ_j8jqPR5A";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("Supabase Cloud Production Database Connected! 🚀");

// --- MIDDLEWARE: Token Verification ---
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "Access Denied!" });
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) { res.status(403).json({ message: "Invalid Token!" }); }
};

// =======================================================
// 2. PRODUCTS APIs (SUPABASE)
// =======================================================
app.get("/products", async (req, res) => {
  const { data, error } = await supabase.from("products").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/products", async (req, res) => {
  const { data, error } = await supabase.from("products").insert([req.body]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data[0]);
});

app.delete("/products/:id", async (req, res) => {
  const { error } = await supabase.from("products").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Deleted!" });
});

app.put("/products/:id", async (req, res) => {
  const { error } = await supabase.from("products").update(req.body).eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Updated!" });
});

// =======================================================
// 3. AUTH APIs (SUPABASE)
// =======================================================
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  
  // Check user exists
  const { data: userExists } = await supabase.from("users").select("*").eq("email", email).single();
  if (userExists) return res.status(400).json({ message: "Email already exists!" });

  const { data, error } = await supabase.from("users").insert([{ email, password }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data[0]);
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { data: user, error } = await supabase.from("users").select("*").eq("email", email).single();

  if (error || !user || user.password !== password) {
    return res.status(400).json({ message: "Invalid credentials!" });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ message: "Login Successful!", token, user: { id: user.id, email: user.email } });
});

// =======================================================
// 4. CART APIs (SUPABASE)
// =======================================================
app.get("/cart", verifyToken, async (req, res) => {
  const { data, error } = await supabase.from("carts").select("*").eq("email", req.user.email);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/cart", verifyToken, async (req, res) => {
  const { productId, quantity } = req.body;
  const email = req.user.email;

  const { data: item } = await supabase.from("carts").select("*").eq("email", email).eq("productId", productId).single();

  if (item) {
    const { error } = await supabase.from("carts").update({ quantity: item.quantity + Number(quantity) }).eq("id", item.id);
    if (error) return res.status(500).json({ error: error.message });
  } else {
    const { error } = await supabase.from("carts").insert([{ email, productId, quantity: Number(quantity) }]);
    if (error) return res.status(500).json({ error: error.message });
  }
  res.json({ message: "Cart Updated!" });
});

// =======================================================
// 5. CHECKOUT & ORDERS APIs (SUPABASE)
// =======================================================
app.post("/checkout", verifyToken, async (req, res) => {
  const email = req.user.email;

  try {
    const { data: userCartItems } = await supabase.from("carts").select("*").eq("email", email);
    if (!userCartItems || userCartItems.length === 0) {
      return res.status(400).json({ message: "Apka cart khali hai!" });
    }

    const { data: allProducts } = await supabase.from("products").select("*");
    let grandTotal = 0;
    
    const orderItems = userCartItems.map(cartItem => {
      const matchedProd = allProducts.find(p => String(p.id) === String(cartItem.productId));
      const price = matchedProd ? matchedProd.price : 0;
      const name = matchedProd ? matchedProd.name : "Unknown Product";
      grandTotal += price * cartItem.quantity;

      return { productId: cartItem.productId, name, price, quantity: cartItem.quantity };
    });

    const { data: newOrder, error: orderErr } = await supabase.from("orders").insert([{
      email: email,
      items: orderItems,
      totalAmount: grandTotal,
      orderDate: new Date().toLocaleString(),
      status: "Pending"
    }]).select();

    if (orderErr) return res.status(500).json({ error: orderErr.message });

    // Clear Cart
    await supabase.from("carts").delete().eq("email", email);

    res.status(201).json({ 
      message: "Order placed successfully! 🎁", 
      orderId: newOrder[0].id,
      totalBill: grandTotal
    });

  } catch (error) {
    res.status(500).json({ message: "Checkout karne me server error!" });
  }
});

app.get("/orders", verifyToken, async (req, res) => {
  const { data, error } = await supabase.from("orders").select("*").eq("email", req.user.email);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// =======================================================
// 6. ADMIN DASHBOARD STATS (SUPABASE)
// =======================================================
app.get("/admin/stats", async (req, res) => {
  try {
    const { data: allOrders } = await supabase.from("orders").select("*");
    const { data: allUsers } = await supabase.from("users").select("*");
    
    let totalRevenue = 0;
    if (allOrders) {
      allOrders.forEach(order => { totalRevenue += Number(order.totalAmount || 0); });
    }

    res.json({
      totalOrders: allOrders ? allOrders.length : 0,
      totalUsers: allUsers ? allUsers.length : 0,
      totalRevenue: totalRevenue,
      ordersList: allOrders || []
    });
  } catch (error) {
    res.status(500).json({ message: "Admin data load karne me dikkat!" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });