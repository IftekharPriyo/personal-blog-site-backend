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
const articleId = "448e184e-8a7f-4471-b9c8-3a6cb0dff0af";
const categoryId = "28ebc460-a035-4a07-854b-bca946330360";
const tagId = "4fb06a7c-f5ee-44a5-818a-e332e8b890ed";
const createdAt = new Date("2026-06-20T10:00:00.000Z");
const updatedAt = new Date("2026-06-21T10:00:00.000Z");

let baseUrl;
let originals;
let server;

function token() {
  return jwt.sign({ userId: admin.id }, process.env.JWT_SECRET, { expiresIn: "5m" });
}

function authHeaders(extra = {}) {
  return {
    authorization: `Bearer ${token()}`,
    ...extra,
  };
}

function databaseArticle(overrides = {}) {
  return {
    id: articleId,
    title: "MDX from the database",
    slug: "mdx-from-the-database",
    excerpt: null,
    content: "## Hello\n\n<Callout>Stored as MDX.</Callout>",
    coverImage: null,
    status: "DRAFT",
    authorId: admin.id,
    categoryId,
    travelCountryId: null,
    publishedAt: null,
    createdAt,
    updatedAt,
    author: { id: admin.id, name: admin.name },
    category: { id: categoryId, name: "Tech" },
    tags: [{ tag: { id: tagId, name: "Node.js" } }],
    ...overrides,
  };
}

function validPayload(overrides = {}) {
  return {
    title: "MDX from the database",
    slug: "mdx-from-the-database",
    excerpt: "An MDX article",
    content: "## Hello\n\n<Callout>Stored as MDX.</Callout>",
    coverImage: "https://example.com/cover.jpg",
    status: "DRAFT",
    categoryId,
    tagIds: [tagId],
    newTags: [],
    publishedAt: null,
    ...overrides,
  };
}

before(async () => {
  originals = {
    userFindUnique: prisma.user.findUnique,
    articleFindMany: prisma.blogPost.findMany,
    articleFindUnique: prisma.blogPost.findUnique,
    articleDelete: prisma.blogPost.delete,
    transaction: prisma.$transaction,
  };

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  prisma.user.findUnique = async () => admin;
  prisma.blogPost.findMany = originals.articleFindMany;
  prisma.blogPost.findUnique = originals.articleFindUnique;
  prisma.blogPost.delete = originals.articleDelete;
  prisma.$transaction = originals.transaction;
});

after(async () => {
  prisma.user.findUnique = originals.userFindUnique;
  prisma.blogPost.findMany = originals.articleFindMany;
  prisma.blogPost.findUnique = originals.articleFindUnique;
  prisma.blogPost.delete = originals.articleDelete;
  prisma.$transaction = originals.transaction;

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("article routes require authentication", async () => {
  const response = await fetch(`${baseUrl}/api/articles`);
  assert.equal(response.status, 401);
});

test("GET /api/articles returns serialized articles", async () => {
  prisma.blogPost.findMany = async () => [databaseArticle()];

  const response = await fetch(`${baseUrl}/api/articles`, {
    headers: authHeaders(),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.articles.length, 1);
  assert.deepEqual(body.articles[0].tags, [{ id: tagId, name: "Node.js" }]);
  assert.equal(body.articles[0].content, "## Hello\n\n<Callout>Stored as MDX.</Callout>");
});

test("GET /api/articles/:id returns 404 when the article does not exist", async () => {
  prisma.blogPost.findUnique = async () => null;

  const response = await fetch(`${baseUrl}/api/articles/${articleId}`, {
    headers: authHeaders(),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: "Article not found" });
});

test("POST /api/articles validates request data", async () => {
  const response = await fetch(`${baseUrl}/api/articles`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ title: "Missing the rest" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, "Invalid request data");
  assert.ok(body.errors.some((error) => error.field === "content"));
});

test("POST /api/articles creates an article without changing its MDX", async () => {
  const mdx = "# Heading\n\n```js\nconst answer = 42;\n```\n\n<Callout />";
  let createArgs;

  prisma.$transaction = async (callback) =>
    callback({
      category: { findUnique: async () => ({ id: categoryId }) },
      tag: {
        findMany: async () => [{ id: tagId }],
        findFirst: async () => ({ id: tagId }),
        create: async () => {
          throw new Error("An existing tag should be reused");
        },
      },
      blogPost: {
        create: async (args) => {
          createArgs = args;
          return databaseArticle({ content: mdx });
        },
      },
    });

  const response = await fetch(`${baseUrl}/api/articles`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(
      validPayload({ content: mdx, tagIds: [], newTags: ["Node.js"] }),
    ),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(createArgs.data.content, mdx);
  assert.equal(createArgs.data.authorId, admin.id);
  assert.equal(createArgs.data.tags.create[0].tag.connect.id, tagId);
  assert.equal(body.article.content, mdx);
});

test("POST /api/articles returns 409 for a duplicate slug", async () => {
  prisma.$transaction = async () => {
    const error = new Error("Unique constraint failed");
    error.code = "P2002";
    throw error;
  };

  const response = await fetch(`${baseUrl}/api/articles`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(validPayload()),
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    message: "An article with this slug already exists",
  });
});

test("PUT /api/articles/:id replaces fields and tag relationships", async () => {
  let updateArgs;

  prisma.$transaction = async (callback) =>
    callback({
      category: { findUnique: async () => ({ id: categoryId }) },
      tag: {
        findMany: async () => [{ id: tagId }],
        findFirst: async () => null,
        create: async () => ({ id: tagId }),
      },
      blogPost: {
        findUnique: async () => ({ id: articleId, publishedAt: null }),
        update: async (args) => {
          updateArgs = args;
          return databaseArticle({ title: "Updated article", status: "PUBLISHED" });
        },
      },
    });

  const response = await fetch(`${baseUrl}/api/articles/${articleId}`, {
    method: "PUT",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(
      validPayload({ title: "Updated article", status: "PUBLISHED", publishedAt: undefined }),
    ),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(updateArgs.data.title, "Updated article");
  assert.ok(updateArgs.data.publishedAt instanceof Date);
  assert.deepEqual(updateArgs.data.tags.deleteMany, {});
  assert.equal(body.article.title, "Updated article");
});

test("DELETE /api/articles/:id returns 204", async () => {
  let deletedId;
  prisma.blogPost.delete = async ({ where }) => {
    deletedId = where.id;
    return databaseArticle();
  };

  const response = await fetch(`${baseUrl}/api/articles/${articleId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  assert.equal(response.status, 204);
  assert.equal(deletedId, articleId);
  assert.equal(await response.text(), "");
});

test("DELETE /api/articles/:id returns 404 when the article does not exist", async () => {
  prisma.blogPost.delete = async () => {
    const error = new Error("Record not found");
    error.code = "P2025";
    throw error;
  };

  const response = await fetch(`${baseUrl}/api/articles/${articleId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  assert.equal(response.status, 404);
});
