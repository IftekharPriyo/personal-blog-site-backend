const express = require("express");

const {
  createArticle,
  deleteArticle,
  getArticle,
  listArticleOptions,
  listArticles,
  updateArticle,
} = require("../controllers/articleController");
const { authorizeAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authorizeAdmin);

router.get("/", listArticles);
router.post("/", createArticle);
router.get("/options", listArticleOptions);
router.get("/:id", getArticle);
router.put("/:id", updateArticle);
router.delete("/:id", deleteArticle);

module.exports = router;
