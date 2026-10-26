const express = require("express");
const router = express.Router();
const { Abonnement } = require("../models/abonnements");  
const { Category } = require("../models/categories");
const upload = require("../middleware/upload");

/**
 * `categories` arrives from the dashboard's FormData either as a repeated
 * field (-> array) or as one comma-joined string, so accept both and hand back
 * a clean list of ids. Returns [] when nothing was sent, which the model reads
 * as "every category".
 */
const parseCategories = (value) => {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(",");
  return [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))];
};

/** Rejects the request when any id is not a real category. */
const findUnknownCategory = async (ids) => {
  for (const id of ids) {
    const exists = await Category.findById(id).catch(() => null);
    if (!exists) return id;
  }
  return null;
};

// Get all abonnements
router.get("/", async (req, res) => {
  try {
    const abonnements = await Abonnement.find()
      .populate("category", "name")
      .populate("categories", "name")
      .sort({ createdAt: -1 });
    res.status(200).json(abonnements);
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des abonnements", error });
  }
});

// Get a single abonnement by ID
router.get("/:id", async (req, res) => {
  try {
    const abonnement = await Abonnement.findById(req.params.id)
      .populate("category", "name")
      .populate("categories", "name");
    if (!abonnement) {
      return res.status(404).json({ success: false, message: "Abonnement non trouvé" });
    }
    res.status(200).json(abonnement);
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur lors de la récupération de l'abonnement", error });
  }
});

// Create a new abonnement
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, sessionCount, duration, price, category } = req.body;

     if (!name || !sessionCount || !duration || !price) {
      return res.status(400).json({ success: false, message: "Tous les champs sont requis" });
    }

    // Validate category if provided (null = all categories)
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(404).json({ success: false, message: "La catégorie n'existe pas" });
      }
    }

    // Which categories the plan pays for; empty = all of them.
    const categories = parseCategories(req.body.categories) ?? [];
    const unknownCategory = await findUnknownCategory(categories);
    if (unknownCategory) {
      return res.status(404).json({
        success: false,
        message: `La catégorie ${unknownCategory} n'existe pas`,
      });
    }

     let imagePath = "";
    if (req.file) {
      imagePath = req.file.path;
    }

      const abonnement = new Abonnement({
      name,
      sessionCount,
      duration,
      price,
      category: category || null,
      categories,
      image: imagePath || "",
    });

     const savedAbonnement = await abonnement.save();
    await savedAbonnement.populate("category", "name");
    await savedAbonnement.populate("categories", "name");
    res.status(201).json({ success: true, data: savedAbonnement });
  } catch (error) {
    console.error("Error creating abonnement:", error);
    res.status(500).json({
      success: false,
      message: "Erreur interne lors de la création de l'abonnement",
      error,
    });
  }
});

// Delete an abonnement by ID
router.delete("/:id", async (req, res) => {
  try {
    const abonnement = await Abonnement.findByIdAndRemove(req.params.id);
    if (!abonnement) {
      return res.status(404).json({ success: false, message: "Abonnement non trouvé" });
    }
    res.status(200).json({ success: true, message: "Abonnement supprimé avec succès" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur lors de la suppression de l'abonnement", error });
  }
});

router.put("/:abonnementId", upload.single("image"), async (req, res) => {
  try {
    const { abonnementId } = req.params;
    const { name, sessionCount, duration, price, category } = req.body;

    // Find the abonnement by ID
    const abonnement = await Abonnement.findById(abonnementId);

    if (!abonnement) {
      return res.status(404).send("Abonnement not found");
    }

    // Validate category if provided, allow null/empty for all categories
    if (category !== undefined && category !== "") {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(404).json({ success: false, message: "La catégorie n'existe pas" });
      }
      abonnement.category = category;
    } else if (category !== undefined) {
      abonnement.category = null; // all categories
    }

    // Left out of the request = keep what the plan already covers.
    const categories = parseCategories(req.body.categories);
    if (categories !== undefined) {
      const unknownCategory = await findUnknownCategory(categories);
      if (unknownCategory) {
        return res.status(404).json({
          success: false,
          message: `La catégorie ${unknownCategory} n'existe pas`,
        });
      }
      abonnement.categories = categories;
    }

    // Update only the provided fields
    if (name) {
      abonnement.name = name;
    }

    if (sessionCount !== undefined) {
      abonnement.sessionCount = sessionCount;
    }

    if (duration !== undefined) {
      abonnement.duration = duration;
    }

    if (price !== undefined) {
      abonnement.price = price;
    }

    if (req.file) {
      abonnement.image = req.file.path;
    }

    // Save the updated abonnement
    await abonnement.save();
    await abonnement.populate("category", "name");
    await abonnement.populate("categories", "name");
    res.status(200).send(abonnement);
  } catch (error) {
    console.error("Error updating abonnement:", error);
    res.status(500).send("Error updating abonnement");
  }
});



module.exports = router;
