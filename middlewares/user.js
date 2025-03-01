const jwt = require('jsonwebtoken');
const { JWT_USER_PASSWORD } = require("../config");
const userModel = require("../db");

const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_USER_PASSWORD);
    req.userId = decoded.userId;

    
    
    req.phone = decoded.phone; // Attach the full user object to the request
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = authenticateUser;
