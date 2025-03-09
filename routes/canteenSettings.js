const express = require('express');
const { Router } = require("express");
const { canteenSettingsModel } = require('../db'); // Adjust the path as needed



const settingRouter = Router();

// GET endpoint to fetch canteen settings (returns an extra 'isOpen' field)
settingRouter.get('/', async (req, res) => {
  try {
    let settings = await canteenSettingsModel.findOne({});
    if (!settings) {
      // Create default settings if none exist
      settings = await canteenSettingsModel.create({
        openTime: "09:00",  // default opening time
        closeTime: "03:00"  // default closing time (3 AM next day)
      });
    }
    // Compute whether the canteen is open using the helper function
   
    // Convert the Mongoose document to a plain object and add the isOpen field
    res.json({ ...settings.toObject() });
  } catch (error) {
    res.status(500).json({ message: "Error fetching settings", error: error.message });
  }
});

// PUT endpoint to update canteen settings (admin protected route if needed)
settingRouter.put('/', async (req, res) => {
  try {
    const { openTime, closeTime } = req.body;
    if (!openTime || !closeTime) {
      return res.status(400).json({ message: "Both openTime and closeTime are required" });
    }
    const settings = await canteenSettingsModel.findOneAndUpdate(
      {},
      { openTime, closeTime },
      { new: true, upsert: true }
    );
    res.json({ message: "Settings updated successfully", settings });
  } catch (error) {
    res.status(500).json({ message: "Error updating settings", error: error.message });
  }
});

module.exports = settingRouter;
