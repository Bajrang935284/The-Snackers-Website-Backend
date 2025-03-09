

// Place Order (with user verification)
const express = require('express');
const orderRouter = express.Router();
const { menuModel, orderModel,tokenConterModel } = require("../db");
const authenticateUser = require("../middlewares/user")

// Place Order (with user verification)
orderRouter.post('/place-order', authenticateUser, async (req, res) => {
  try {
    const { orderItems, deliveryDetails } = req.body;
    const userId = req.userId;
    const phone = req.phone;
    // Validate delivery type and fields
    if (!deliveryDetails?.type || !['delivery', 'pickup'].includes(deliveryDetails.type)) {
      return res.status(400).json({ message: 'Invalid delivery type' });
    }

    if (deliveryDetails.type === 'delivery' && !deliveryDetails.hostelName) {
      return res.status(400).json({ message: 'Hostel name is required for delivery' });
    }

    if (deliveryDetails.type === 'pickup' && !deliveryDetails.pickupTime) {
      return res.status(400).json({ message: 'Pickup time is required for pickup' });
    }

    // Process order items (FIXED: Added closing ) for Promise.all)
    const processedItems = await Promise.all(
      orderItems.map(async (item) => {
        const menuItem = await menuModel.findById(item.itemId);
        if (!menuItem) throw new Error(`Menu item ${item.itemId} not found`);
        return {
          itemId: item.itemId,
          name: menuItem.title,
          quantity: item.quantity,
          price: menuItem.price
        };
      }) // <-- Added closing )
    );

    // Calculate total
    const totalAmount = processedItems.reduce(
      (total, item) => total + (item.price * item.quantity), 
      0
    );
     
    let tokenCounter = await tokenConterModel.findOneAndUpdate(
      { name: 'orderToken' },
      { $inc: { current: 1 } },
      { new: true, upsert: true }
    );

    let tokenNo = tokenCounter.current;

    // Reset token to 1 if it exceeds 100
    if (tokenNo > 100) {
      tokenNo = 1;
      tokenCounter.current = 1;
      await tokenCounter.save();
    }

    // Create order
    const newOrder = await orderModel.create({
      userId,
      orderItems: processedItems,
      totalAmount,
      tokenNo: tokenNo.toString(),
      phone,
      deliveryDetails: {
        type: deliveryDetails.type,
        hostelName: deliveryDetails.hostelName || null,
        pickupTime: deliveryDetails.pickupTime || null
      }
    });

    res.status(201).json({
      message: 'Order placed successfully',
      orderId: newOrder._id,
      totalAmount,
      tokenNo: newOrder.tokenNo
    });

  } catch (error) {
    console.error('Order placement error:', error);
    res.status(500).json({ 
      message: 'Order placement failed', 
      error: error.message 
    });
  }
});

// Fetch User Orders (Completed and Current) - No changes needed here
orderRouter.get('/my-orders', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    const orders = await orderModel.find({ userId }).sort({ createdAt: -1 });

    const completedOrders = orders.filter(order => 
      ['Delivered', 'Cancelled'].includes(order.orderStatus)
    );
    const currentOrders = orders.filter(order => 
      ['Placed', 'Preparing', 'Ready', 'Out for Delivery'].includes(order.orderStatus)
    );

    res.status(200).json({ completedOrders, currentOrders });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      message: 'Failed to fetch orders', 
      error: error.message 
    });
  }
});


module.exports = orderRouter;