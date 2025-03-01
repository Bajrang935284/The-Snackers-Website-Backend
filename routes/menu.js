
 
const { Router } = require("express");
const mongoose = require("mongoose");
const { menuModel } = require("../db");
const { z } = require("zod");
const adminmiddleware  = require("../middlewares/admin");
const path = require("path");


const menuRouter = Router();



// Zod validation schema for menu items
const menuItemSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  
  price: z.coerce.number().positive("Price must be a positive number"),
  isAvailable: z.coerce.boolean(),
  category: z.string().min(1, "Category is required"),
  updatedBy: z.string().length(24, "Invalid ObjectId"),
});

// Middleware for request validation using Zod.
const validateMenuItem = (req, res, next) => {
  try {
    menuItemSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      message: "Validation failed",
      errors: error.errors,
    });
  }
};

/**
 * POST /menu
 * This route handles uploading an image and creating a new menu item.
 */
menuRouter.post(
  "/menu",
  
  validateMenuItem,
  async (req, res) => {
    try {
      await menuModel.create({
        title: req.body.title,
        price: req.body.price,
        category: req.body.category,
        isAvailable: req.body.isAvailable,
        updatedBy: req.body.updatedBy,
      });

      res.status(201).json({
        message: "Item added successfully",
        
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to add item",
        error: error.message,
      });
    }
  }
);

// GET /searchedItem: Search for available menu items based on title or description.
menuRouter.get("/searchedItem", async (req, res) => {
  const { query } = req.query;

  try {
    // Search across title, description, and category (all case-insensitive)
    const results = await menuModel.find({
      isAvailable: true,
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
      ],
    });

    res.json({
      message: "Search successful",
      results: results,
    });
  } catch (error) {
    res.status(500).json({
      message: "Search failed",
      error: error.message,
    });
  }
});

// GET /search: Retrieve all available menu items.
menuRouter.get("/search", async (req, res) => {
  try {
    const results = await menuModel.find({ isAvailable: true });
    res.json({
      message: "Search successful",
      results: results,
    });
  } catch (error) {
    res.status(500).json({
      message: "Search failed",
      error: error.message,
    });
  }
});
menuRouter.get("/admin/search", async (req, res) => {
  try {
    const results = await menuModel.find({}); // Admin sees all items
    res.json({
      message: "Admin menu retrieval successful",
      results: results,
    });
  } catch (error) {
    res.status(500).json({
      message: "Admin menu retrieval failed",
      error: error.message,
    });
  }
});

// PATCH /item/:id: Update the availability of a menu item.
menuRouter.patch("/item/:id", async (req, res) => {
  const { id } = req.params;
  const { isAvailable } = req.body;

  try {
    const menuItem = await menuModel.findByIdAndUpdate(
      id,
      { isAvailable },
      { new: true }
    );

    if (!menuItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json({
      message: "Menu item updated successfully",
      menuItem,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update menu item",
      error: error.message,
    });
  }
});

module.exports = menuRouter;
