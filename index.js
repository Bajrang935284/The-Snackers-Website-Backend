require('dotenv').config()
console.log(process.env.MONGO_URL)
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const userRouter  = require("./routes/user");
const menuRouter = require("./routes/menu")
const orderRouter = require("./routes/order")
const adminRouter  = require("./routes/admin");
const settingRouter = require("./routes/canteenSettings")
const app = express();
app.use(express.json());

app.use(cors({
    origin: ['http://localhost:5173', 'http://192.168.1.133:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // Allowed HTTP methods
    credentials: true // If using cookies or authentication tokens
  }));

app.use(express.static(path.join(__dirname, "public")));
app.use("/api/v1/user",  userRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/menu",  menuRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/settings", settingRouter);

async function main() {
    await mongoose.connect(process.env.MONGO_URL)
    app.listen(3000);
    console.log("listening on port 3000")
}

main()