const { Router } = require("express");
const { adminModel,orderModel,tokenConterModel,walkInOrderModel} = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { JWT_ADMIN_PASSWORD } = require("../config");
const adminRouter = Router();
const adminMiddleware = require('../middlewares/admin')
// Helper function to exclude password from admin data
const sanitizeAdmin = (admin) => {
  const { password, ...adminWithoutPassword } = admin.toObject();
  return adminWithoutPassword;
};

// Signup Route
adminRouter.post("/signup", async function(req, res) {
  try {
    const { email, password, name } = req.body;
    
    // Check if admin exists
    const existingAdmin = await adminModel.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({ message: "Admin already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    const admin = await adminModel.create({
      email,
      password: hashedPassword,
      name
    });

    // Generate JWT
    const token = jwt.sign({ adminId: admin._id }, JWT_ADMIN_PASSWORD);

    res.status(201).json({
      token,
      admin: sanitizeAdmin(admin)
    });
  } catch (error) {
    console.error("Admin Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Signin Route
adminRouter.post("/signin", async function(req, res) {
  try {
    const { email, password } = req.body;

    // Find admin
    const admin = await adminModel.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign({ adminId: admin._id }, JWT_ADMIN_PASSWORD);

    res.json({
      token,
      admin: sanitizeAdmin(admin)
    });
  } catch (error) {
    console.error("Admin Signin error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Auth Me Route
adminRouter.get("/auth/me", async function(req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_ADMIN_PASSWORD);
    const admin = await adminModel.findById(decoded.adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json(sanitizeAdmin(admin));
  } catch (error) {
    console.error("Admin Auth error:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});


adminRouter.post('/walkin-order',async (req, res) => {
  try {
    const { orderItems } = req.body;

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    // Calculate totalAmount
    const totalAmount = orderItems.reduce((total, item) => {
      if (!item.name || !item.quantity || !item.price) {
        throw new Error('Invalid item format. Name, quantity, and price are required.');
      }
      return total + (item.quantity * item.price);
    }, 0);

    // Get next token number (shared with online orders)
    let tokenCounter = await tokenConterModel.findOneAndUpdate(
      { name: 'orderToken' },
      { $inc: { current: 1 } },
      { new: true, upsert: true }
    );

    let tokenNo = tokenCounter.current;

    if (tokenNo > 100) {
      tokenNo = 1;
      tokenCounter.current = 1;
      await tokenCounter.save();
    }

    // Create walk-in order
    const newWalkInOrder = await walkInOrderModel.create({
      tokenNo: tokenNo.toString(),
      orderItems,
      totalAmount,
      orderType: 'dine In'
    });

    res.status(201).json({
      message: 'Walk-in order placed successfully',
      orderId: newWalkInOrder._id,
      tokenNo: newWalkInOrder.tokenNo,
      totalAmount
    });

  } catch (error) {
    console.error('Walk-in order error:', error);
    res.status(500).json({ message: 'Walk-in order failed', error: error.message });
  }
});


adminRouter.get("/orders",adminMiddleware, async (req, res) => {
    try {
      const { status } = req.query;
      const filter = status ? { orderStatus: status } : {};
      
      const orders = await orderModel.find(filter)
        .populate('userId', 'name email') // Assuming user model has name and email
        .sort({ createdAt: -1 });
      
      res.json({ orders });
    } catch (error) {
      res.status(500).json({ message: "Error fetching orders", error: error.message });
    }
  });
  
  adminRouter.put("/orders/:id/status", adminMiddleware, async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = [
        'Placed', 'Preparing', 'Ready', 
        'Out for Delivery', 'Delivered', 'Cancelled'
      ];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedOrder = await orderModel.findByIdAndUpdate(
        req.params.id,
        { orderStatus: status },
        { new: true }
      );
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json({
        message: "Order status updated successfully",
        order: updatedOrder
      });
    } catch (error) {
      res.status(500).json({ message: "Error updating order status", error: error.message });
    }
  });

  adminRouter.put("/orders/:id/payment-status", adminMiddleware, async (req, res) => {
    try {
      const { paymentStatus } = req.body;
      const validPaymentStatuses = ['Pending', 'Paid', 'Failed']; // Adjust as needed
  
      if (!validPaymentStatuses.includes(paymentStatus)) {
        return res.status(400).json({ message: "Invalid payment status" });
      }
  
      const updatedOrder = await orderModel.findByIdAndUpdate(
        req.params.id,
        { paymentStatus },
        { new: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
  
      res.json({
        message: "Payment status updated successfully",
        order: updatedOrder,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error updating payment status",
        error: error.message,
      });
    }
  });
  
  
  adminRouter.delete("/orders/:id", adminMiddleware, async (req, res) => {
    try {
      const order = await orderModel.findByIdAndUpdate(
        req.params.id,
        { orderStatus: 'Cancelled' },
        { new: true }
      );
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json({ message: "Order cancelled successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error cancelling order", error: error.message });
    }
  });
  
  module.exports = adminRouter;