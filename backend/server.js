const express = require("express");
const cors = require("cors");
const datastore = require("nedb-promises");
const jwt = require("jsonwebtoken");
const path = require("path"); // FIXED: Path module add kiya absolute routing ke liye

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = "AnantMart_Super_Secret_Key_2026";

// =======================================================
// 1. DATABASES CONNECTION (FIXED FOR CLOUD DIRECT STORAGE)
// =======================================================
// path.join(__dirname, ...) se ab data direct project folder ke andar sahi files me save hoga
const Product = datastore.create({ filename: path.join(__dirname, "products.db"), autoload: true });
const User = datastore.create({ filename: path.join(__dirname, "users.db"), autoload: true });
const Cart = datastore.create({ filename: path.join(__dirname, "carts.db"), autoload: true });
const Order = datastore.create({ filename: path.join(__dirname, "orders.db"), autoload: true }); 

console.log("All Databases (Products, Users, Carts, Orders) Connected Safely in Root! 🚀");

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

// --- EXISTING APIs (PRODUCTS, AUTH, CART) ---
app.get("/products", async (req, res) => { res.json(await Product.find({})); });
app.post("/products", async (req, res) => { const p = await Product.insert(req.body); res.status(201).json(p); });
app.delete("/products/:id", async (req, res) => { await Product.deleteOne({ _id: req.params.id }); res.json({ message: "Deleted!" }); });
app.put("/products/:id", async (req, res) => { await Product.update({ _id: req.params.id }, { $set: req.body }); res.json({ message: "Updated!" }); });
app.post("/register", async (req, res) => {
  const userExists = await User.findOne({ email: req.body.email });
  if (userExists) return res.status(400).json({ message: "Email already exists!" });
  const newUser = await User.insert(req.body); res.status(201).json(newUser);
});
app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user || user.password !== req.body.password) return res.status(400).json({ message: "Invalid credentials!" });
  const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ message: "Login Successful!", token, user: { id: user._id, email: user.email } });
});
app.get("/cart", verifyToken, async (req, res) => { res.json(await Cart.find({ email: req.user.email })); });
app.post("/cart", verifyToken, async (req, res) => {
  const { productId, quantity } = req.body;
  const item = await Cart.findOne({ email: req.user.email, productId });
  if (item) {
    await Cart.update({ _id: item._id }, { $set: { quantity: item.quantity + Number(quantity) } });
  } else {
    await Cart.insert({ email: req.user.email, productId, quantity: Number(quantity) });
  }
  res.json({ message: "Cart Updated!" });
});


// =======================================================
// 2. CHECKOUT & ORDER CREATION API (DAY 15 TASK)
// =======================================================
app.post("/checkout", verifyToken, async (req, res) => {
  const email = req.user.email;

  try {
    const userCartItems = await Cart.find({ email: email });

    if (userCartItems.length === 0) {
      return res.status(400).json({ message: "Apka cart khali hai! Order place nahi ho sakta." });
    }

    const allProducts = await Product.find({});
    let grandTotal = 0;
    
    const orderItems = userCartItems.map(cartItem => {
      const matchedProd = allProducts.find(p => p._id === cartItem.productId);
      const price = matchedProd ? matchedProd.price : 0;
      const name = matchedProd ? matchedProd.name : "Unknown Product";
      grandTotal += price * cartItem.quantity;

      return {
        productId: cartItem.productId,
        name: name,
        price: price,
        quantity: cartItem.quantity
      };
    });

    const newOrder = await Order.insert({
      email: email,
      items: orderItems,
      totalAmount: grandTotal,
      orderDate: new Date().toLocaleString(),
      status: "Pending" 
    });

    await Cart.remove({ email: email }, { multi: true }); 

    res.status(201).json({ 
      message: "Order placed successfully! 🎁", 
      orderId: newOrder._id,
      totalBill: grandTotal
    });

  } catch (error) {
    console.error("Checkout Error:", error);
    res.status(500).json({ message: "Checkout karne me server error!" });
  }
});

app.get("/orders", verifyToken, async (req, res) => {
  try {
    const userOrders = await Order.find({ email: req.user.email });
    res.json(userOrders);
  } catch (error) { res.status(500).json({ message: "Orders lane me dikkat aayi!" }); }
});

// =======================================================
// DAY 16: ADMIN DASHBOARD DATA API
// =======================================================
app.get("/admin/stats", async (req, res) => {
  try {
    const allOrders = await Order.find({});
    const allUsers = await User.find({});
    
    let totalRevenue = 0;
    allOrders.forEach(order => {
      totalRevenue += Number(order.totalAmount || 0);
    });

    res.json({
      totalOrders: allOrders.length,
      totalUsers: allUsers.length,
      totalRevenue: totalRevenue,
      ordersList: allOrders 
    });

  } catch (error) {
    console.error("Admin Stats Error:", error);
    res.status(500).json({ message: "Admin data load karne me dikkat!" });
  }
});

// Port configuration for Render cloud compatibility
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });