
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
});

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Import routes
const userRouter = require("./routes/user");
const menuRouter = require("./routes/menu");
const orderRouter = require("./routes/order");
const adminRouter = require("./routes/admin");
const settingRouter = require("./routes/canteenSettings");

// Create Express app
const app = express();

// Body parser middleware
app.use(express.json()); // Parse JSON request bodies

// CORS configuration - Enhanced for production
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL || 'https://yourdomain.com'] // Use env var or fallback to your domain
  : ['http://localhost:5173', 'http://192.168.1.39:5173']; 

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/api/v1/user", userRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/menu", menuRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/settings", settingRouter);

// Health check endpoint for AWS
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Global error handler - Production ready
app.use((err, req, res, next) => {
  // Log error for monitoring but don't expose details in production
  console.error(err);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
    
  res.status(statusCode).json({
    status: 'error',
    message
  });
});



app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Resource not found`
  });
});



// Graceful server shutdown for AWS
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

// Error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

// MongoDB connection and server startup
async function main() {
  try {
    // Check if MONGO_URL is defined
    if (!process.env.MONGO_URL) {
      console.error('MONGO_URL environment variable is not defined');
      process.exit(1);
    }
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');
    
    // Start server
    const PORT = process.env.PORT || 3000;
    const IP = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    
    const server = app.listen(PORT, IP, () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Server initiated successfully`);
      console.log(`[${timestamp}] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[${timestamp}] Server listening on: ${IP}:${PORT}`);
      console.log(`[${timestamp}] MongoDB connected: ${process.env.MONGO_URL.split('@')[1].split('/')[0]}`); // Log database host without credentials
    });
    
    // Set timeouts for AWS
    server.timeout = 60000; // 60 seconds
    server.keepAliveTimeout = 30000; // 30 seconds
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }
}

main();