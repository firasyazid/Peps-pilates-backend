const express = require("express");
const { Category } = require("../models/categories");  
const router = express.Router();

// POST: Create a new category
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
     if (!name  ) {
      return res.status(400).json({ message: "Name is required" });
    }
     const category = new Category({
      name,
     });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT: Update an existing category by ID
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name  } = req.body;

     const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name  },
      { new: true }  
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(updatedCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Remove a category by ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

     const deletedCategory = await Category.findByIdAndRemove(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get("/", async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});






module.exports = router;
