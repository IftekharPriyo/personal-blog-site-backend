require("dotenv").config();

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const app = require("../src/app");
const { prisma } = require("../src/config/db");

let baseUrl;
let server;
let originalFindMany;
let originalFindFirst;
let originalCount;
let originalViewUpsert;
let originalViewCount;
let originalLoveFindUnique;
let originalLoveUpsert;
let originalLoveDeleteMany;
let originalLoveCount;

function publishedPost() {
  return {
    id: "448e184e-8a7f-4471-b9c8-3a6cb0dff0af",
    title: "Published MDX",
    slug: "published-mdx",
    excerpt: "A public post",
    content: "## Hello\n\nThis is published content.",
    coverImage: null,
    status: "PUBLISHED",
    featured: true,
    publishedAt: new Date("2026-07-05T10:00:00.000Z"),
    updatedAt: new Date("2026-07-05T10:00:00.000Z"),
    category: { id: "category-id", name: "Tech", slug: "tech" },
    tags: [{ tag: { id: "tag-id", name: "Node.js", slug: "nodejs" } }],
    _count: { views: 12, loves: 4 },
  };
}

before(async () => {
  originalFindMany = prisma.blogPost.findMany;
  originalFindFirst = prisma.blogPost.findFirst;
  originalCount = prisma.blogPost.count;
  originalViewUpsert = prisma.blogPostView.upsert;
  originalViewCount = prisma.blogPostView.count;
  originalLoveFindUnique = prisma.blogPostLove.findUnique;
  originalLoveUpsert = prisma.blogPostLove.upsert;
  originalLoveDeleteMany = prisma.blogPostLove.deleteMany;
  originalLoveCount = prisma.blogPostLove.count;
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  prisma.blogPost.findMany = originalFindMany;
  prisma.blogPost.findFirst = originalFindFirst;
  prisma.blogPost.count = originalCount;
  prisma.blogPostView.upsert = originalViewUpsert;
  prisma.blogPostView.count = originalViewCount;
  prisma.blogPostLove.findUnique = originalLoveFindUnique;
  prisma.blogPostLove.upsert = originalLoveUpsert;
  prisma.blogPostLove.deleteMany = originalLoveDeleteMany;
  prisma.blogPostLove.count = originalLoveCount;
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
  prisma.blogPost.count = async (args) => {
    assert.deepEqual(args.where, { status: "PUBLISHED" });
    return 1;
  };

  const response = await fetch(`${baseUrl}/api/posts`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(query.where.status, "PUBLISHED");
  assert.equal(query.skip, 0);
  assert.equal(query.take, 10);
  assert.deepEqual(query.orderBy, [
    { publishedAt: "desc" },
    { updatedAt: "desc" },
    { id: "desc" },
  ]);
  assert.equal(body.posts[0].slug, "published-mdx");
  assert.equal(body.posts[0].featured, true);
  assert.equal(body.posts[0].viewCount, 12);
  assert.equal(body.posts[0].loveCount, 4);
  assert.equal(body.posts[0].content, undefined);
  assert.deepEqual(body.pagination, {
    page: 1,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
});

test("GET /api/posts supports pagination and featured filtering", async () => {
  let findManyArgs;
  let countArgs;

  prisma.blogPost.findMany = async (args) => {
    findManyArgs = args;
    return [publishedPost()];
  };
  prisma.blogPost.count = async (args) => {
    countArgs = args;
    return 13;
  };

  const response = await fetch(
    `${baseUrl}/api/posts?page=3&limit=5&featured=true`,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(findManyArgs.where, {
    status: "PUBLISHED",
    featured: true,
  });
  assert.deepEqual(countArgs.where, {
    status: "PUBLISHED",
    featured: true,
  });
  assert.equal(findManyArgs.skip, 10);
  assert.equal(findManyArgs.take, 5);
  assert.deepEqual(body.pagination, {
    page: 3,
    pageSize: 5,
    totalItems: 13,
    totalPages: 3,
    hasNextPage: false,
    hasPreviousPage: true,
  });
});

test("GET /api/posts rejects invalid pagination parameters", async () => {
  const response = await fetch(`${baseUrl}/api/posts?page=0&limit=100`);
  assert.equal(response.status, 400);
});

test("GET /api/posts/topics returns global published topic counts", async () => {
  prisma.blogPost.findMany = async (args) => {
    assert.deepEqual(args.where, { status: "PUBLISHED" });
    return [
      {
        tags: [
          { tag: { name: "AWS" } },
          { tag: { name: "Node.js" } },
        ],
      },
      {
        tags: [{ tag: { name: "AWS" } }],
      },
    ];
  };

  const response = await fetch(`${baseUrl}/api/posts/topics`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.topics, [
    { name: "AWS", count: 2 },
    { name: "Node.js", count: 1 },
  ]);
});

test("GET /api/posts/:slug returns published MDX content", async () => {
  prisma.blogPost.findFirst = async () => publishedPost();

  const response = await fetch(`${baseUrl}/api/posts/published-mdx`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.post.content, "## Hello\n\nThis is published content.");
  assert.equal(body.post.viewCount, 12);
  assert.equal(body.post.loveCount, 4);
});

test("POST /api/posts/:slug/view records one anonymous reader", async () => {
  const visitorId = "e15fd783-f8d5-4a87-a312-8b086205aa4d";
  let upsertArgs;

  prisma.blogPost.findFirst = async () => ({ id: publishedPost().id });
  prisma.blogPostView.upsert = async (args) => {
    upsertArgs = args;
    return { id: "view-id" };
  };
  prisma.blogPostView.count = async () => 13;

  const response = await fetch(`${baseUrl}/api/posts/published-mdx/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(upsertArgs.where.postId_visitorId, {
    postId: publishedPost().id,
    visitorId,
  });
  assert.equal(body.viewCount, 13);
});

test("POST /api/posts/:slug/view rejects invalid visitor IDs", async () => {
  const response = await fetch(`${baseUrl}/api/posts/published-mdx/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId: "not-a-uuid" }),
  });

  assert.equal(response.status, 400);
});

test("GET /api/posts/:slug/love returns the anonymous reader's state", async () => {
  const visitorId = "e15fd783-f8d5-4a87-a312-8b086205aa4d";
  prisma.blogPost.findFirst = async () => ({ id: publishedPost().id });
  prisma.blogPostLove.findUnique = async () => ({ id: "love-id" });
  prisma.blogPostLove.count = async () => 5;

  const response = await fetch(
    `${baseUrl}/api/posts/published-mdx/love?visitorId=${visitorId}`,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.loved, true);
  assert.equal(body.loveCount, 5);
});

test("PUT /api/posts/:slug/love adds one anonymous love idempotently", async () => {
  const visitorId = "e15fd783-f8d5-4a87-a312-8b086205aa4d";
  let upsertArgs;

  prisma.blogPost.findFirst = async () => ({ id: publishedPost().id });
  prisma.blogPostLove.upsert = async (args) => {
    upsertArgs = args;
    return { id: "love-id" };
  };
  prisma.blogPostLove.count = async () => 5;

  const response = await fetch(`${baseUrl}/api/posts/published-mdx/love`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId }),
  });
  const body = await response.json();

  assert.deepEqual(upsertArgs.where.postId_visitorId, {
    postId: publishedPost().id,
    visitorId,
  });
  assert.equal(body.loved, true);
  assert.equal(body.loveCount, 5);
});

test("DELETE /api/posts/:slug/love removes the anonymous love idempotently", async () => {
  const visitorId = "e15fd783-f8d5-4a87-a312-8b086205aa4d";
  let deleteArgs;

  prisma.blogPost.findFirst = async () => ({ id: publishedPost().id });
  prisma.blogPostLove.deleteMany = async (args) => {
    deleteArgs = args;
    return { count: 1 };
  };
  prisma.blogPostLove.count = async () => 4;

  const response = await fetch(`${baseUrl}/api/posts/published-mdx/love`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId }),
  });
  const body = await response.json();

  assert.deepEqual(deleteArgs.where, {
    postId: publishedPost().id,
    visitorId,
  });
  assert.equal(body.loved, false);
  assert.equal(body.loveCount, 4);
});

test("GET /api/posts/:slug returns 404 for unavailable posts", async () => {
  prisma.blogPost.findFirst = async () => null;
  const response = await fetch(`${baseUrl}/api/posts/missing`);
  assert.equal(response.status, 404);
});
