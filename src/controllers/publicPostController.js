const { z } = require("zod");

const { prisma } = require("../config/db");

const visitorSchema = z.object({
  visitorId: z.string().uuid("A valid visitor ID is required"),
});

const publicInclude = {
  category: { select: { id: true, name: true, slug: true } },
  tags: {
    select: { tag: { select: { id: true, name: true, slug: true } } },
    orderBy: { tag: { name: "asc" } },
  },
  _count: { select: { loves: true, views: true } },
};

function readingTime(content) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

function serializePost(post, includeContent = false) {
  const result = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    featured: post.featured,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    category: post.category,
    tags: post.tags.map(({ tag }) => tag),
    readingTime: readingTime(post.content),
    viewCount: post._count?.views ?? 0,
    loveCount: post._count?.loves ?? 0,
  };

  if (includeContent) result.content = post.content;
  return result;
}

async function trackPublishedPostView(req, res, next) {
  const parsed = visitorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "A valid visitor ID is required" });
  }

  try {
    const post = await prisma.blogPost.findFirst({
      where: { slug: req.params.slug, status: "PUBLISHED" },
      select: { id: true },
    });

    if (!post) return res.status(404).json({ message: "Post not found" });

    await prisma.blogPostView.upsert({
      where: {
        postId_visitorId: {
          postId: post.id,
          visitorId: parsed.data.visitorId,
        },
      },
      create: { postId: post.id, visitorId: parsed.data.visitorId },
      update: {},
    });

    const viewCount = await prisma.blogPostView.count({
      where: { postId: post.id },
    });

    return res.json({ viewCount });
  } catch (error) {
    return next(error);
  }
}

async function findPublishedPostId(slug) {
  return prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true },
  });
}

async function getPublishedPostLove(req, res, next) {
  const parsed = visitorSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "A valid visitor ID is required" });
  }

  try {
    const post = await findPublishedPostId(req.params.slug);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const [love, loveCount] = await Promise.all([
      prisma.blogPostLove.findUnique({
        where: {
          postId_visitorId: {
            postId: post.id,
            visitorId: parsed.data.visitorId,
          },
        },
        select: { id: true },
      }),
      prisma.blogPostLove.count({ where: { postId: post.id } }),
    ]);

    return res.json({ loved: Boolean(love), loveCount });
  } catch (error) {
    return next(error);
  }
}

async function lovePublishedPost(req, res, next) {
  const parsed = visitorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "A valid visitor ID is required" });
  }

  try {
    const post = await findPublishedPostId(req.params.slug);
    if (!post) return res.status(404).json({ message: "Post not found" });

    await prisma.blogPostLove.upsert({
      where: {
        postId_visitorId: {
          postId: post.id,
          visitorId: parsed.data.visitorId,
        },
      },
      create: { postId: post.id, visitorId: parsed.data.visitorId },
      update: {},
    });

    const loveCount = await prisma.blogPostLove.count({
      where: { postId: post.id },
    });

    return res.json({ loved: true, loveCount });
  } catch (error) {
    return next(error);
  }
}

async function unlovePublishedPost(req, res, next) {
  const parsed = visitorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "A valid visitor ID is required" });
  }

  try {
    const post = await findPublishedPostId(req.params.slug);
    if (!post) return res.status(404).json({ message: "Post not found" });

    await prisma.blogPostLove.deleteMany({
      where: { postId: post.id, visitorId: parsed.data.visitorId },
    });

    const loveCount = await prisma.blogPostLove.count({
      where: { postId: post.id },
    });

    return res.json({ loved: false, loveCount });
  } catch (error) {
    return next(error);
  }
}

async function listPublishedPosts(req, res, next) {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      include: publicInclude,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    });

    return res.json({ posts: posts.map((post) => serializePost(post)) });
  } catch (error) {
    return next(error);
  }
}

async function getPublishedPost(req, res, next) {
  try {
    const post = await prisma.blogPost.findFirst({
      where: { slug: req.params.slug, status: "PUBLISHED" },
      include: publicInclude,
    });

    if (!post) return res.status(404).json({ message: "Post not found" });
    return res.json({ post: serializePost(post, true) });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getPublishedPost,
  getPublishedPostLove,
  listPublishedPosts,
  lovePublishedPost,
  trackPublishedPostView,
  unlovePublishedPost,
};
