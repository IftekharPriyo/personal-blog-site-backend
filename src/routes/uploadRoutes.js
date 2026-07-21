const express = require("express");
const multer = require("multer");

const {
  uploadArticleImage,
  uploadCoverImage,
} = require("../controllers/uploadController");
const { authorizeAdmin } = require("../middleware/authMiddleware");

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (SUPPORTED_IMAGE_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    const error = new Error("Only JPG, PNG, and WEBP images are supported");
    error.statusCode = 400;
    callback(error);
  },
});

const router = express.Router();

router.use(authorizeAdmin);
router.post("/cover-image", upload.single("image"), uploadCoverImage);
router.post("/article-image", upload.single("image"), uploadArticleImage);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Image must be 5MB or smaller" });
    }

    return res.status(400).json({ message: error.message });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  return next(error);
});

module.exports = router;
