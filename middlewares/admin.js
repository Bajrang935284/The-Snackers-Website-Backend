const jwt = require("jsonwebtoken");
const { JWT_ADMIN_PASSWORD } = require("../config");

function adminMiddleware(req, res, next) {
  // Get the token from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization header missing or malformed" });
  }
  
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token is missing" });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_ADMIN_PASSWORD);
    // Assuming your token payload contains the admin ID under adminId (or use decoded.id if that's how it's set)
    req.userId = decoded.adminId || decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token", error: error.message });
  }
}

module.exports = adminMiddleware;
