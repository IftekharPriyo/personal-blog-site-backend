require("dotenv").config();

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret";

const app = require("../src/app");
const { prisma } = require("../src/config/db");

let baseUrl;
let originalFindUnique;
let server;

before(async () => {
  originalFindUnique = prisma.user.findUnique;
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  prisma.user.findUnique = originalFindUnique;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("protected endpoint rejects requests without a token", async () => {
  const response = await fetch(`${baseUrl}/api/auth/protected`);
  assert.equal(response.status, 401);
});

test("protected endpoint accepts a valid admin token", async () => {
  prisma.user.findUnique = async () => ({
    id: "admin-id",
    name: "Test Admin",
    email: "admin@example.com",
    role: "ADMIN",
  });

  const token = jwt.sign({ userId: "admin-id" }, process.env.JWT_SECRET, {
    expiresIn: "5m",
  });
  const response = await fetch(`${baseUrl}/api/auth/protected`, {
    headers: { cookie: `jwt=${token}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.message, "Authorization is working");
  assert.equal(body.user.role, "ADMIN");
});

test("protected endpoint rejects a non-admin user", async () => {
  prisma.user.findUnique = async () => ({
    id: "editor-id",
    name: "Test Editor",
    email: "editor@example.com",
    role: "EDITOR",
  });

  const token = jwt.sign({ userId: "editor-id" }, process.env.JWT_SECRET, {
    expiresIn: "5m",
  });
  const response = await fetch(`${baseUrl}/api/auth/protected`, {
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.status, 403);
});
