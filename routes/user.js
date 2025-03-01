const { Router } = require("express");
const { userModel } = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { JWT_USER_PASSWORD } = require("../config");

const userRouter = Router();

// Helper function to exclude password from user data
const sanitizeUser = (user) => {
  const { password, ...userWithoutPassword } = user.toObject();
  return userWithoutPassword;
};

// Signup Route
userRouter.post("/signup", async function(req, res) {
  try {
    const { email, password, name,phone } = req.body;
    
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
    const token = jwt.sign(  { userId: user._id, phone: user.phone }, JWT_USER_PASSWORD, );

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
    const token = jwt.sign(   { userId: user._id, phone: user.phone }, JWT_USER_PASSWORD);

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
    const decoded = jwt.verify(token,   JWT_USER_PASSWORD);
    
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