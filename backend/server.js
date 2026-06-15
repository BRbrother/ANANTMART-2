const express = require("express");
const cors = require("cors");
const datastore = require("nedb-promises");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = "AnantMart_Super_Secret_Key_2026";

// =======================================================
// 1. DATABASES CONNECTION (Day 15: Orders DB Added)
// =======================================================
const Product = datastore.create({ filename: "products.db", autoload: true });
const User = datastore.create({ filename: "users.db", autoload: true });
const Cart = datastore.create({ filename: "carts.db", autoload: true });
const Order = datastore.create({ filename: "orders.db", autoload: true }); // DAY 15

console.log("All Databases (Products, Users, Carts, Orders) Connected! 🚀");

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
    // 1. User ke cart se saare items uthana
    const userCartItems = await Cart.find({ email: email });

    if (userCartItems.length === 0) {
      return res.status(400).json({ message: "Apka cart khali hai! Order place nahi ho sakta." });
    }

    // 2. Saare products ki original list lana price calculate karne ke liye
    const allProducts = await Product.find({});
    let grandTotal = 0;
    
    // Final items list taiyar karna jisme original name aur price bhi linked ho
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

    // 3. Naya Order Object database me insert karna
    const newOrder = await Order.insert({
      email: email,
      items: orderItems,
      totalAmount: grandTotal,
      orderDate: new Date().toLocaleString(),
      status: "Pending" // Default status delivery ke liye
    });

    // 4. Order successfully place hone ke baad user ka cart khali kar dena
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

// User ke purane orders dekhne ki API (Bonus)
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
    // 1. Database se saare orders aur total users nikalna
    const allOrders = await Order.find({});
    const allUsers = await User.find({});
    
    // 2. Total Revenue (Kamai) calculate karna
    let totalRevenue = 0;
    allOrders.forEach(order => {
      totalRevenue += Number(order.totalAmount || 0);
    });

    // 3. Ek hi baar me saara stats object frontend ko bhej dena
    res.json({
      totalOrders: allOrders.length,
      totalUsers: allUsers.length,
      totalRevenue: totalRevenue,
      ordersList: allOrders // Saare orders ki list tables me dikhane ke liye
    });

  } catch (error) {
    console.error("Admin Stats Error:", error);
    res.status(500).json({ message: "Admin data load karne me dikkat!" });
  }
});
app.listen(3000, () => { console.log("Server running on port 3000"); });