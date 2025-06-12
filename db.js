const mongoose = require("mongoose");
const { string } = require("zod");

const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

// User Schema
const userSchema = new Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    phone: { 
      type: String, 
      required: true, 
      unique: true, 
      match: [/^\d{10}$/, "Please enter a valid 10-digit phone number"] 
    },
    resetPasswordToken: String,
  resetPasswordExpires: Date,
});

// Admin Schema
const adminSchema = new Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
});

// Order Schema
const orderSchema = new Schema({
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    phone: {
      type: String,
      required: true, 
    },
    tokenNo: {
         type: String,
         required: true
    },
    orderItems: [
      {
        itemId: { 
          type: Schema.Types.ObjectId, 
          ref: "Menu", 
          required: true 
        },
        name: { 
          type: String, 
          required: true 
        },
        quantity: { 
          type: Number, 
          required: true,
          min: [1, 'Quantity cannot be less than 1'] 
        },
        price: { 
          type: Number, 
          required: true 
        }
      }
    ],
    totalAmount: { 
      type: Number, 
      required: true 
    },
    orderStatus: {
      type: String,
      enum: ["Placed", "Preparing", "Ready", "Out for Delivery", "Delivered", "Cancelled"],
      default: "Placed"
    },
    statusHistory: [{
      status: {
        type: String,
        enum: ["Placed", "Preparing", "Ready", "Out for Delivery", "Delivered", "Cancelled"]
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      notes: String
    }],
    canteenAdminId: { 
      type: Schema.Types.ObjectId, 
      ref: "Admin" 
    },
    deliveryDetails: {
      type: {
        type: String,
        enum: ["delivery", "pickup"],
        required: true
      },
      hostelName: { 
        type: String, 
        required: function() {
          return this.deliveryDetails.type === "delivery";
        } 
      }
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Completed", "Refunded"],
      default: "Pending"
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now 
    }
  });
  
  // Pre-save hook (updated)
  orderSchema.pre('save', function(next) {
    if (this.isModified('orderStatus')) {
      this.statusHistory.push({
        status: this.orderStatus,
        notes: this.orderStatus === 'Cancelled' ? 'User cancelled order' : null
      });
    }
    this.updatedAt = Date.now(); // Update timestamp on every save
    next();
  });


  const walkInOrderSchema = new Schema({
  tokenNo: {
    type: String,
    required: true
  },
  orderItems: [
    {
      name: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true
      },
      price: {
        type: Number,
        required: true
      }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  createdAt: { 
      type: Date, 
      default: Date.now 
    },
  orderType: {
    type: String,
    
    default: "dine In"
  }
});

// Menu Schema
const menuSchema = new Schema({
    title: { type: String, required: true },
    
    price: { type: Number, required: true },
    category: {type: String, required: true},
    isAvailable: { type: Boolean, default: true },
    updatedBy: { type: ObjectId, ref: "Admin" },
});
  
const tokenCounterSchema = new Schema ({
  name: { type: String, required: true, unique: true },
  current: { type: Number, default: 1 }
});

const canteenSettingsSchema = new Schema({
  openTime: {
    type: String,
    required: true,
    default: "09:00"    
  },
  closeTime: {
    type: String,
    required: true,
    default: "03:00"    
  },
  deliveryAvailable: {
    type: Boolean,
    default: true
  },
  pickupAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});



const userModel = mongoose.model("User", userSchema);
const adminModel = mongoose.model("Admin", adminSchema);
const menuModel = mongoose.model("Menu", menuSchema);
const orderModel = mongoose.model("Order", orderSchema);
const tokenConterModel = mongoose.model('TokenCounter', tokenCounterSchema);
const canteenSettingsModel = mongoose.model('canteenSettings', canteenSettingsSchema );
const walkInOrderModel = mongoose.model('WalkInOrder', walkInOrderSchema)

module.exports = {
    userModel,
    adminModel,
    menuModel,
    orderModel,
    tokenConterModel,
    canteenSettingsModel,
   walkInOrderModel
};
