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

async function uploadCoverImage(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ message: "Cover image file is required" });
  }

  const extension = IMAGE_EXTENSIONS[req.file.mimetype];
  if (!extension) {
    return res.status(400).json({
      message: "Only JPG, PNG, and WEBP images are supported",
    });
  }

  const imageId = randomUUID();
  const sourceKey = `incoming/covers/${imageId}.${extension}`;
  const key = `articles/covers/${imageId}.webp`;

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
          "upload-purpose": "article-cover",
        },
      }),
    );

    return res.status(201).json({
      message: "Cover image uploaded successfully",
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

module.exports = { uploadCoverImage };
