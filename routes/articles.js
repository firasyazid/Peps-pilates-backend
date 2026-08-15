const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { Article } = require("../models/articles");

// POST /api/articles - Create a new article
router.post("/", upload.fields([{ name: "image" }, { name: "video" }]), async (req, res) => {
  try {
    const { title, content1, content2 } = req.body;

    if (!title || !content1) {
      return res.status(400).json({ message: "Title and content1 are required." });
    }

    let imagePath = "";
    let videoPath = "";

    if (req.files && req.files.image) {
      imagePath = req.files.image[0].path;
    }

    if (req.files && req.files.video) {
      videoPath = req.files.video[0].path;
    }

    const article = new Article({
      title,
      content1,
      content2,
      image: imagePath,
      video: videoPath,
    });

    const savedArticle = await article.save();
    res.status(201).json({ success: true, data: savedArticle });
  } catch (error) {
    console.error("Error creating article:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/articles - Get all articles
router.get(`/`, async (req, res) => {
  const userList = await Article.find();

  if (!userList) {
    res.status(500).json({ success: false });
  }
  res.status(200).send(userList);
});


// GET /api/articles/:id - Get a specific article by ID
router.get("/:id", async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, message: "Article not found" });
    }
    res.status(200).json({ success: true, data: article });
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.delete("/:id", (req, res) => {
  Article.findByIdAndRemove(req.params.id)
    .then((user) => {
      if (user) {
        return res
          .status(200)
          .json({ success: true, message: "the Article is deleted!" });
      } else {
        return res
          .status(404)
          .json({ success: false, message: "Article not found!" });
      }
    })
    .catch((err) => {
      return res.status(500).json({ success: false, error: err });
    });
});

router.put("/:articleId", upload.fields([{ name: "image" }, { name: "video" }]), async (req, res) => {
  try {
    const { articleId } = req.params;
    const { title, content1, content2 } = req.body;

    // Find the article by ID
    const article = await Article.findById(articleId);

    if (!article) {
      return res.status(404).send("Article not found");
    }

    // Update only the provided fields
    if (title) {
      article.title = title;
    }

    if (content1) {
      article.content1 = content1;
    }

    if (content2) {
      article.content2 = content2;
    }

    if (req.files && req.files.image) {
      article.image = req.files.image[0].path;
    }

    if (req.files && req.files.video) {
      article.video = req.files.video[0].path;
    }

    // Save the updated article
    await article.save();
    res.status(200).send(article);
  } catch (error) {
    console.error("Error updating article:", error);
    res.status(500).send("Error updating article");
  }
});

module.exports = router;
