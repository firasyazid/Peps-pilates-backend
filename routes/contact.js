const express = require("express");
const { Contact } = require("../models/contact"); // Adjust the path as per your project structure
const router = express.Router();

// POST route: Add a new contact
router.post("/", async (req, res) => {
    try {
        const { email, message } = req.body;

        // Validate input
        if (!email || !message) {
            return res.status(400).json({ error: "Email and message are required." });
        }

        // Create a new contact document
        const contact = new Contact({
            email,
            message,
        });

        await contact.save();
        res.status(201).json(contact);
    } catch (error) {
        res.status(500).json({ error: "An error occurred while saving the contact." });
    }
});

// GET route: Get all contacts
router.get("/", async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 }); // Sort by latest
        res.status(200).json(contacts);
    } catch (error) {
        res.status(500).json({ error: "An error occurred while retrieving the contacts." });
    }
});

module.exports = router;
