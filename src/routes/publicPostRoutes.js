const express = require("express");
const {
  getPublishedPost,
  getPublishedPostLove,
  listPublishedPosts,
  lovePublishedPost,
  trackPublishedPostView,
  unlovePublishedPost,
} = require("../controllers/publicPostController");

const router = express.Router();

router.get("/", listPublishedPosts);
router.post("/:slug/view", trackPublishedPostView);
router.get("/:slug/love", getPublishedPostLove);
router.put("/:slug/love", lovePublishedPost);
router.delete("/:slug/love", unlovePublishedPost);
router.get("/:slug", getPublishedPost);

module.exports = router;
