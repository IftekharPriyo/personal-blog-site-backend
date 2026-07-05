const express = require("express");
const {
  getPublishedPost,
  listPublishedPosts,
} = require("../controllers/publicPostController");

const router = express.Router();

router.get("/", listPublishedPosts);
router.get("/:slug", getPublishedPost);

module.exports = router;
