const { S3Client } = require("@aws-sdk/client-s3");

class S3ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "S3ConfigurationError";
  }
}

let client;

function getS3Config() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  const publicUrl = process.env.AWS_S3_PUBLIC_URL?.replace(/\/$/, "");

  const missing = [
    ["AWS_REGION", region],
    ["AWS_S3_BUCKET", bucket],
    ["AWS_S3_PUBLIC_URL", publicUrl],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new S3ConfigurationError(
      `S3 uploads are not configured. Missing: ${missing.join(", ")}`,
    );
  }

  return { region, bucket, publicUrl };
}

function getS3Client() {
  const { region } = getS3Config();

  if (!client) {
    client = new S3Client({ region });
  }

  return client;
}

function getS3PublicUrl(key) {
  const { publicUrl } = getS3Config();
  return `${publicUrl}/${key}`;
}

module.exports = {
  S3ConfigurationError,
  getS3Client,
  getS3Config,
  getS3PublicUrl,
};
