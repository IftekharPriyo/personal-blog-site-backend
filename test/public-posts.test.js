require("dotenv").config();

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const app = require("../src/app");
const { prisma } = require("../src/config/db");

let baseUrl;
let server;
let originalFindMany;
let originalFindFirst;

function publishedPost() {
  return {
    id: "448e184e-8a7f-4471-b9c8-3a6cb0dff0af",
    title: "Published MDX",
    slug: "published-mdx",
    excerpt: "A public post",
    content: "## Hello\n\nThis is published content.",
    coverImage: null,
    status: "PUBLISHED",
    publishedAt: new Date("2026-07-05T10:00:00.000Z"),
    updatedAt: new Date("2026-07-05T10:00:00.000Z"),
    category: { id: "category-id", name: "Tech", slug: "tech" },
    tags: [{ tag: { id: "tag-id", name: "Node.js", slug: "nodejs" } }],
  };
}

before(async () => {
  originalFindMany = prisma.blogPost.findMany;
  originalFindFirst = prisma.blogPost.findFirst;
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  prisma.blogPost.findMany = originalFindMany;
  prisma.blogPost.findFirst = originalFindFirst;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("GET /api/posts returns published post summaries without authentication", async () => {
  let query;
  prisma.blogPost.findMany = async (args) => {
    query = args;
    return [publishedPost()];
  };

  const response = await fetch(`${baseUrl}/api/posts`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(query.where.status, "PUBLISHED");
  assert.equal(body.posts[0].slug, "published-mdx");
  assert.equal(body.posts[0].content, undefined);
});

test("GET /api/posts/:slug returns published MDX content", async () => {
  prisma.blogPost.findFirst = async () => publishedPost();

  const response = await fetch(`${baseUrl}/api/posts/published-mdx`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.post.content, "## Hello\n\nThis is published content.");
});

test("GET /api/posts/:slug returns 404 for unavailable posts", async () => {
  prisma.blogPost.findFirst = async () => null;
  const response = await fetch(`${baseUrl}/api/posts/missing`);
  assert.equal(response.status, 404);
});
