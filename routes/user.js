const { Router } = require("express");
const { userModel } = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { JWT_USER_PASSWORD } = require("../config");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const userRouter = Router();

// Helper function to exclude password from user data
const sanitizeUser = (user) => {
  const { password, ...userWithoutPassword } = user.toObject();
  return userWithoutPassword;
};

// Signup Route
userRouter.post("/signup", async function(req, res) {
  try {
    const { email, password, name, phone } = req.body;
    
    // Check if user exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await userModel.create({
      email,
      password: hashedPassword,
      name,
      phone
    });
    
    // Generate JWT
    const token = jwt.sign({ userId: user._id, phone: user.phone }, JWT_USER_PASSWORD);
    
    res.status(201).json({
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Signin Route
userRouter.post("/signin", async function(req, res) {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Generate JWT
    const token = jwt.sign({ userId: user._id, phone: user.phone }, JWT_USER_PASSWORD);
    
    res.json({
      token,
      user: sanitizeUser(user)
    });
    
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Auth Me Route
userRouter.get("/auth/me", async function(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_USER_PASSWORD);
    
    // Find user
    const user = await userModel.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(sanitizeUser(user));
  } catch (error) {
    console.error("Auth me error:", error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// Forgot Password Route
userRouter.post("/forgot-password", async function(req, res) {
  try {
    const { email } = req.body;
    
    // Find user
    const user = await userModel.findOne({ email });
    
    // If user doesn't exist, still return success for security
    if (!user) {
      return res.status(200).json({ 
        message: "If that email exists in our system, a password reset link will be sent." 
      });
    }
    
    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Save token and expiry to user record
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // Create reset URL
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    // Setup email transport
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    // Email options
    const mailOptions = {
      from: process.env.EMAIL_USERNAME || 'bbana15102004@gmail.com',
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset for your account.</p>
        <p>Please click the link below to reset your password:</p>
        <a href="${resetUrl}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>This link is valid for 1 hour.</p>
        <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
      `
    };
    
    // Send email
    await transporter.sendMail(mailOptions);
    
    res.status(200).json({ 
      message: "If that email exists in our system, a password reset link will be sent." 
    });
    
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Verify Reset Token Route
userRouter.get("/reset-password/:token", async function(req, res) {
  try {
    const { token } = req.params;
    
    // Find user with this token and check if it's still valid
    const user = await userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: "Password reset token is invalid or has expired" });
    }
    
    res.status(200).json({ message: "Token is valid" });
    
  } catch (error) {
    console.error("Verify reset token error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Reset Password Route
userRouter.post("/reset-password/:token", async function(req, res) {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    // Find user with valid token
    const user = await userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: "Password reset token is invalid or has expired" });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update user password and clear reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();
    
    res.status(200).json({ message: "Password has been reset successfully" });
    
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
userRouter.put("/update-profile", async function(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const decoded = jwt.verify(token, JWT_USER_PASSWORD);
    const userId = decoded.userId;
    const { name, email, password } = req.body;

    // Check if new email is used by another user
    if (email) {
      const emailExists = await userModel.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    let updateFields = { name, email };
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.password = hashedPassword;
    }

    const updatedUser = await userModel.findByIdAndUpdate(userId, updateFields, { new: true });
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(updatedUser));
  } catch (error) {
    console.error("Update profile error:", error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = userRouter;