require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const categories = [
  { name: "Tech", slug: "tech" },
  { name: "Travel", slug: "travel" },
  { name: "Life", slug: "life" },
];

const tags = [
  { name: "AWS", slug: "aws" },
  { name: "DevOps", slug: "devops" },
  { name: "Cloud", slug: "cloud" },
  { name: "Docker", slug: "docker" },
  { name: "Kubernetes", slug: "kubernetes" },
  { name: "Linux", slug: "linux" },
  { name: "Node.js", slug: "nodejs" },
  { name: "React", slug: "react" },
  { name: "PostgreSQL", slug: "postgresql" },
  { name: "Malaysia", slug: "malaysia" },
  { name: "UTM", slug: "utm" },
  { name: "Johor Bahru", slug: "johor-bahru" },
  { name: "Photography", slug: "photography" },
  { name: "Career", slug: "career" },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
