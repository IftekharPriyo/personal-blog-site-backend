const { z } = require("zod");

const { prisma } = require("../config/db");

const POST_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

const optionalText = (maxLength) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(maxLength).nullable().optional(),
  );

const articleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(200)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain lowercase letters, numbers, and single hyphens only",
    ),
  excerpt: optionalText(500),
  content: z
    .string()
    .max(900_000, "Content must be at most 900,000 characters")
    .refine((value) => value.trim().length > 0, "Content is required"),
  coverImage: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().trim().url("Cover image must be a valid URL").max(2048).nullable().optional(),
  ),
  status: z.enum(POST_STATUSES).default("DRAFT"),
  featured: z.boolean().default(false),
  categoryId: z.string().uuid("A valid category ID is required"),
  tagIds: z.array(z.string().uuid("Each tag ID must be valid")).max(50).default([]),
  newTags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});

const articleInclude = {
  author: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  tags: {
    select: { tag: { select: { id: true, name: true } } },
    orderBy: { tag: { name: "asc" } },
  },
};

class RequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function validationError(res, error) {
  return res.status(400).json({
    message: "Invalid request data",
    errors: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function serializeArticle(article) {
  return {
    ...article,
    tags: article.tags.map(({ tag }) => tag),
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function validateCategory(tx, categoryId) {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) throw new RequestError(404, "Category not found");
}

async function resolveTagIds(tx, tagIds, newTags) {
  const uniqueTagIds = [...new Set(tagIds)];

  if (uniqueTagIds.length) {
    const existingTags = await tx.tag.findMany({
      where: { id: { in: uniqueTagIds } },
      select: { id: true },
    });

    if (existingTags.length !== uniqueTagIds.length) {
      throw new RequestError(404, "One or more tags were not found");
    }
  }

  const normalizedNames = [...new Set(newTags.map((name) => name.replace(/\s+/g, " ")))];

  for (const name of normalizedNames) {
    const slug = slugify(name);
    if (!slug) {
      throw new RequestError(400, `Tag "${name}" cannot be converted to a valid slug`);
    }

    const existingTag = await tx.tag.findFirst({
      where: {
        OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }],
      },
      select: { id: true },
    });

    const tag =
      existingTag ||
      (await tx.tag.create({
        data: { name, slug },
        select: { id: true },
      }));
    uniqueTagIds.push(tag.id);
  }

  return [...new Set(uniqueTagIds)];
}

function getPublishedAt(status, existingArticle = null) {
  if (status !== "PUBLISHED") return existingArticle?.publishedAt ?? null;
  if (existingArticle?.status === "PUBLISHED") return existingArticle.publishedAt;
  return new Date();
}

function articleData(data, publishedAt) {
  return {
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt ?? null,
    content: data.content,
    coverImage: data.coverImage ?? null,
    status: data.status,
    featured: data.featured,
    categoryId: data.categoryId,
    publishedAt,
  };
}

function handleControllerError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error.code === "P2002") {
    return res.status(409).json({ message: "An article with this slug already exists" });
  }

  if (error.code === "P2025") {
    return res.status(404).json({ message: "Article not found" });
  }

  return next(error);
}

async function listArticles(req, res, next) {
  try {
    const articles = await prisma.blogPost.findMany({
      include: articleInclude,
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ articles: articles.map(serializeArticle) });
  } catch (error) {
    return next(error);
  }
}

async function listArticleOptions(req, res, next) {
  try {
    const [categories, tags] = await Promise.all([
      prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.tag.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return res.json({ categories, tags });
  } catch (error) {
    return next(error);
  }
}

async function getArticle(req, res, next) {
  try {
    const article = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      include: articleInclude,
    });

    if (!article) return res.status(404).json({ message: "Article not found" });
    return res.json({ article: serializeArticle(article) });
  } catch (error) {
    return next(error);
  }
}

async function createArticle(req, res, next) {
  const parsed = articleSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const article = await prisma.$transaction(async (tx) => {
      await validateCategory(tx, parsed.data.categoryId);
      const tagIds = await resolveTagIds(tx, parsed.data.tagIds, parsed.data.newTags);

      return tx.blogPost.create({
        data: {
          ...articleData(parsed.data, getPublishedAt(parsed.data.status)),
          authorId: req.user.id,
          tags: {
            create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
          },
        },
        include: articleInclude,
      });
    });

    return res.status(201).json({
      message: "Article created successfully",
      article: serializeArticle(article),
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

async function updateArticle(req, res, next) {
  const parsed = articleSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const article = await prisma.$transaction(async (tx) => {
      const existingArticle = await tx.blogPost.findUnique({
        where: { id: req.params.id },
        select: { id: true, status: true, publishedAt: true },
      });

      if (!existingArticle) throw new RequestError(404, "Article not found");

      await validateCategory(tx, parsed.data.categoryId);
      const tagIds = await resolveTagIds(tx, parsed.data.tagIds, parsed.data.newTags);

      return tx.blogPost.update({
        where: { id: req.params.id },
        data: {
          ...articleData(
            parsed.data,
            getPublishedAt(parsed.data.status, existingArticle),
          ),
          tags: {
            deleteMany: {},
            create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
          },
        },
        include: articleInclude,
      });
    });

    return res.json({
      message: "Article updated successfully",
      article: serializeArticle(article),
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

async function deleteArticle(req, res, next) {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

module.exports = {
  createArticle,
  deleteArticle,
  getArticle,
  listArticleOptions,
  listArticles,
  updateArticle,
};
