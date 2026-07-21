require("dotenv").config();

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret";

const app = require("../src/app");
const { prisma } = require("../src/config/db");

const admin = {
  id: "02e8b047-06c1-435a-8e67-8a3d50b881d4",
  name: "Test Admin",
  email: "admin@example.com",
  role: "ADMIN",
};

let baseUrl;
let originalFindUnique;
let originalAwsEnv;
let server;

function token() {
  return jwt.sign({ userId: admin.id }, process.env.JWT_SECRET, { expiresIn: "5m" });
}

before(async () => {
  originalFindUnique = prisma.user.findUnique;
  originalAwsEnv = {
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_S3_PUBLIC_URL: process.env.AWS_S3_PUBLIC_URL,
  };

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  prisma.user.findUnique = async () => admin;
  delete process.env.AWS_REGION;
  delete process.env.AWS_S3_BUCKET;
  delete process.env.AWS_S3_PUBLIC_URL;
});

after(async () => {
  prisma.user.findUnique = originalFindUnique;

  for (const [key, value] of Object.entries(originalAwsEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("cover image upload requires authentication", async () => {
  const response = await fetch(`${baseUrl}/api/uploads/cover-image`, {
    method: "POST",
  });

  assert.equal(response.status, 401);
});

test("cover image upload returns a clear error when S3 is not configured", async () => {
  const formData = new FormData();
  formData.append("image", new Blob(["not really an image"], { type: "image/png" }), "cover.png");

  const response = await fetch(`${baseUrl}/api/uploads/cover-image`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token()}`,
    },
    body: formData,
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.match(body.message, /S3 uploads are not configured/);
});

test("article image upload requires authentication", async () => {
  const response = await fetch(`${baseUrl}/api/uploads/article-image`, {
    method: "POST",
  });

  assert.equal(response.status, 401);
});

test("article image upload returns a clear error when S3 is not configured", async () => {
  const formData = new FormData();
  formData.append(
    "image",
    new Blob(["not really an image"], { type: "image/png" }),
    "article.png",
  );

  const response = await fetch(`${baseUrl}/api/uploads/article-image`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token()}`,
    },
    body: formData,
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.match(body.message, /S3 uploads are not configured/);
});
