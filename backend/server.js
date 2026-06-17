const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose"); // NeDB hataya, Mongoose joda

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "AnantMart_Super_Secret_Key_2026";

// =======================================================
// 1. DYNAMIC MONGODB CLOUD CONNECTION (100% FREE)
// =======================================================
// Agar cloud link nahi mila, toh ye automatic local mongo use karega
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://anantmart_user:AnantMart2026@cluster0.mongodb.net/anantmart?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Cloud Database Connected Permanently! 🚀"))
  .catch(err => console.error("Database connection error:", err));

// Chote Models Schemas (Taaki aapki baaki saari APIs pehle jaisi hi kaam karein)
const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
const Cart = mongoose.model("Cart", new mongoose.Schema({}, { strict: false }));
const Order = mongoose.model("Order", new mongoose.Schema({}, { strict: false }));


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