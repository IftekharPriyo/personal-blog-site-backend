const { randomUUID } = require("node:crypto");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

const {
  S3ConfigurationError,
  getS3Client,
  getS3Config,
  getS3PublicUrl,
} = require("../config/s3");

const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const IMAGE_UPLOAD_CONFIG = {
  cover: {
    missingFileMessage: "Cover image file is required",
    sourcePrefix: "incoming/covers",
    targetPrefix: "articles/covers",
    uploadPurpose: "article-cover",
    successMessage: "Cover image uploaded successfully",
  },
  article: {
    missingFileMessage: "Article image file is required",
    sourcePrefix: "incoming/articles",
    targetPrefix: "articles/content",
    uploadPurpose: "article-content",
    successMessage: "Article image uploaded successfully",
  },
};

async function uploadImage(req, res, next, config) {
  if (!req.file) {
    return res.status(400).json({ message: config.missingFileMessage });
  }

  const extension = IMAGE_EXTENSIONS[req.file.mimetype];
  if (!extension) {
    return res.status(400).json({
      message: "Only JPG, PNG, and WEBP images are supported",
    });
  }

  const imageId = randomUUID();
  const sourceKey = `${config.sourcePrefix}/${imageId}.${extension}`;
  const key = `${config.targetPrefix}/${imageId}.webp`;

  try {
    const { bucket } = getS3Config();
    const client = getS3Client();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: sourceKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        Metadata: {
          "target-key": key,
          "upload-purpose": config.uploadPurpose,
        },
      }),
    );

    return res.status(201).json({
      message: config.successMessage,
      url: getS3PublicUrl(key),
      key,
      sourceKey,
    });
  } catch (error) {
    if (error instanceof S3ConfigurationError) {
      return res.status(503).json({ message: error.message });
    }

    return next(error);
  }
}

function uploadCoverImage(req, res, next) {
  return uploadImage(req, res, next, IMAGE_UPLOAD_CONFIG.cover);
}

function uploadArticleImage(req, res, next) {
  return uploadImage(req, res, next, IMAGE_UPLOAD_CONFIG.article);
}

module.exports = { uploadArticleImage, uploadCoverImage };
