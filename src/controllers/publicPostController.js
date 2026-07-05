const { prisma } = require("../config/db");

const publicInclude = {
  category: { select: { id: true, name: true, slug: true } },
  tags: {
    select: { tag: { select: { id: true, name: true, slug: true } } },
    orderBy: { tag: { name: "asc" } },
  },
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
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    category: post.category,
    tags: post.tags.map(({ tag }) => tag),
    readingTime: readingTime(post.content),
  };

  if (includeContent) result.content = post.content;
  return result;
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

module.exports = { getPublishedPost, listPublishedPosts };
