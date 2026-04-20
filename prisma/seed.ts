import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const topics = [
  { slug: "technology", name: "Technology" },
  { slug: "business", name: "Business" },
  { slug: "sports", name: "Sports" },
  { slug: "health", name: "Health" },
  { slug: "science", name: "Science" },
  { slug: "entertainment", name: "Entertainment" },
  { slug: "general", name: "General" },
  { slug: "other", name: "Other" },
];

const languages = [
  { code: "en", name: "English" },
  { code: "hy", name: "Armenian" },
];

const sources = [
  { slug: "nytimes",   name: "NY Times",   language: "en" },
  { slug: "bbc",       name: "BBC",         language: "en" },
  { slug: "theverge",  name: "The Verge",   language: "en" },
  { slug: "civilnet",  name: "Civilnet",    language: "en" },
  { slug: "hetq",      name: "Hetq",        language: "en" },
  { slug: "newsam",    name: "News.am",     language: "en" },
];

async function main() {
  for (const topic of topics) {
    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: { name: topic.name },
      create: topic,
    });
  }
  console.log("Seeded topics:", topics.map((t) => t.name).join(", "));

  for (const language of languages) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: { name: language.name },
      create: language,
    });
  }
  console.log("Seeded languages:", languages.map((l) => l.name).join(", "));

  for (const source of sources) {
    await prisma.source.upsert({
      where: { slug: source.slug },
      update: { name: source.name, language: source.language },
      create: source,
    });
  }
  console.log("Seeded sources:", sources.map((s) => s.name).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
