const express = require("express");
const router = express.Router();
const { Coach } = require("../models/coach");
const upload = require("../middleware/upload");


// POST /api/coaches - Create a new coach

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, bio, expertise } = req.body;

    let imagePath = "";
    if (req.file) {
      imagePath = req.file.path;
    }

    const coach = new Coach({
      name,
      bio,
      expertise,
      image: imagePath || null,
    });

    const savedCoach = await coach.save();
    res.status(201).json(savedCoach);
  } catch (error) {
    console.error("Error creating coach:", error);
    res.status(500).send("Internal Server Error");
  }
});


router.get('/total', async (req, res) => {
  try {
    const count = await Coach.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// GET /api/coaches - Get all coaches
router.get("/", async (req, res) => {
  try {
    const coaches = await Coach.find();
    res.status(200).json(coaches);
  } catch (error) {
    console.error("Error fetching coaches:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.delete("/:id", (req, res) => {
  Coach.findByIdAndRemove(req.params.id)
    .then((user) => {
      if (user) {
        return res
          .status(200)
          .json({ success: true, message: "the coach is deleted!" });
      } else {
        return res
          .status(404)
          .json({ success: false, message: "coach not found!" });
      }
    })
    .catch((err) => {
      return res.status(500).json({ success: false, error: err });
    });
});


router.put('/:id', upload.single("image"), async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      bio: req.body.bio,
      expertise: req.body.expertise,
    };

    if (req.file) {
      updateData.image = req.file.path;
    } else if (req.body.image) {
      updateData.image = req.body.image;
    }

    const coach = await Coach.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!coach) return res.status(400).send("The coach cannot be updated!");

    res.send(coach);
  } catch (error) {
    console.error("Error updating coach:", error);
    res.status(500).send("Internal Server Error");
  }
});


module.exports = router;
