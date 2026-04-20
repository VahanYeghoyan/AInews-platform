import { prisma } from "./prisma";
import Parser from "rss-parser";
import { detect } from "tinyld";
import { fetchOgImage } from "./og-fetcher";
import { scrapeHetq, scrapeTheVerge, type ScrapedArticle } from "./scraper";

const parser = new Parser({ timeout: 30000 });

// All feed URLs per source — no topic pre-assignment
const SOURCE_FEEDS: Record<string, { name: string; feeds: string[] }> = {
  nytimes: {
    name: "NY Times",
    feeds: [
      "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/DiningandWine.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/FashionandStyle.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Opinion.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/RealEstate.xml",
    ],
  },
  bbc: {
    name: "BBC",
    feeds: [
      "https://feeds.bbci.co.uk/news/rss.xml",
      "https://feeds.bbci.co.uk/news/world/rss.xml",
      "https://feeds.bbci.co.uk/news/uk/rss.xml",
      "https://feeds.bbci.co.uk/news/technology/rss.xml",
      "https://feeds.bbci.co.uk/news/business/rss.xml",
      "https://feeds.bbci.co.uk/sport/rss.xml",
      "https://feeds.bbci.co.uk/news/health/rss.xml",
      "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
      "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
      "https://feeds.bbci.co.uk/news/politics/rss.xml",
      "https://feeds.bbci.co.uk/news/education/rss.xml",
      "https://feeds.bbci.co.uk/news/in_pictures/rss.xml",
    ],
  },
  theverge: {
    name: "The Verge",
    feeds: ["https://www.theverge.com/rss/index.xml"],
  },
  civilnet: {
    name: "Civilnet",
    feeds: ["https://www.civilnet.am/feed/"],
  },
  hetq: {
    name: "Hetq",
    feeds: [
      "https://hetq.am/en/rss",
      "https://hetq.am/hy/rss",
    ],
  },
  newsam: {
    name: "News.am",
    feeds: [
      "https://news.am/eng/rss/",
      "https://news.am/arm/rss/",
    ],
  },
};

// Keywords scored per topic — highest score wins
const TOPIC_KEYWORDS: Record<string, string[]> = {
  technology: [
    "tech", "software", "hardware", "artificial intelligence", " ai ", "machine learning",
    "app", "digital", "cyber", "robot", "startup", "silicon", "apple", "google",
    "microsoft", "amazon", "openai", "iphone", "android", "computer", "internet",
    "algorithm", "chip", "semiconductor", "electric vehicle", "tesla", "programming",
    "cloud", "blockchain", "cryptocurrency", "gadget", "device", "smartphone",
  ],
  business: [
    "business", "economy", "market", "stock", "finance", "trade", "company",
    "invest", "gdp", "inflation", "bank", "revenue", "profit", "earnings",
    "wall street", "economic", "acquisition", "merger", "ipo", "venture capital",
    "retail", "consumer", "tariff", "treasury", "federal reserve", "interest rate",
  ],
  sports: [
    "sport", "football", "basketball", "soccer", "tennis", "golf", "baseball",
    "olympic", "athlete", "championship", "tournament", "league", "nba", "nfl",
    "fifa", "coach", "match", "racing", "formula 1", "f1", "cricket", "rugby",
    "swimming", "marathon", "playoff", "season", "stadium",
  ],
  health: [
    "health", "medical", "medicine", "disease", "vaccine", "hospital", "doctor",
    "patient", "drug", "treatment", "cancer", "covid", "mental health", "diet",
    "fitness", "wellness", "surgery", "clinical", "fda", "pandemic", "virus",
    "obesity", "nutrition", "therapy", "pharmaceutical", "symptom", "diagnosis",
  ],
  science: [
    "science", "research", "scientist", "climate", "space", "nasa", "physics",
    "biology", "chemistry", "environment", "species", "planet", "universe",
    "discovery", "study finds", "researchers", "fossil", "gene", "dna",
    "astronomy", "earthquake", "ocean", "wildlife", "renewable energy", "extinction",
  ],
  entertainment: [
    "movie", "film", "music", "celebrity", "actor", "actress", "singer",
    "album", "concert", "oscar", "grammy", "television", " tv ", "streaming",
    "netflix", "theater", "broadway", "fashion", "style", "food", "dining",
    "recipe", "restaurant", "travel", "tourism", "art", "museum", "book",
    "novel", "award", "box office", "hollywood", "review",
  ],
  general: [
    "politics", "government", "election", "president", "congress", "senate",
    "parliament", "minister", "law", "war", "military", "diplomacy",
    "ukraine", "russia", "china", "middle east", "crime", "immigration",
    "protest", "court", "judge", "policy", "vote", "refugee", "security",
  ],
};

function classifyTopic(title: string, description: string | null): string {
  const text = `${title} ${description ?? ""}`.toLowerCase();

  let bestTopic = "other";
  let bestScore = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const score = keywords.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  return bestTopic;
}

export async function fetchAndStoreNews(): Promise<{
  fetched: number;
  stored: number;
  errors: string[];
}> {
  const topics = await prisma.topic.findMany();
  const sources = await prisma.source.findMany();
  const topicBySlug = Object.fromEntries(topics.map((t) => [t.slug, t]));
  const sourceBySlug = Object.fromEntries(sources.map((s) => [s.slug, s]));

  let totalFetched = 0;
  let totalStored = 0;
  const errors: string[] = [];

  for (const [sourceSlug, sourceConfig] of Object.entries(SOURCE_FEEDS)) {
    const sourceRecord = sourceBySlug[sourceSlug];
    if (!sourceRecord) continue;

    console.log(`\n[${sourceConfig.name}] Starting...`);
    let sourceFetched = 0;
    let sourceStored = 0;

    for (const feedUrl of sourceConfig.feeds) {
      console.log(`  → ${feedUrl}`);
      try {
        const parsed = await parser.parseURL(feedUrl);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const items = parsed.items.filter((item) => {
          if (!item.pubDate) return true;
          return new Date(item.pubDate) >= twentyFourHoursAgo;
        });
        totalFetched += items.length;
        sourceFetched += items.length;

        let feedStored = 0;
        for (const item of items) {
          if (!item.title || !item.link) continue;

          try {
            const description = item.contentSnippet || item.content || null;
            const topicSlug = classifyTopic(item.title, description);
            const topicRecord = topicBySlug[topicSlug] ?? topicBySlug["other"];
            if (!topicRecord) continue;

            const text = [item.title, description].filter(Boolean).join(" ");
            const detectedLanguage = detect(text) || null;
            const rssImage = extractImageUrl(item);
            const imageUrl = rssImage ?? await fetchOgImage(item.link);

            await prisma.article.upsert({
              where: { url: item.link },
              update: {
                topicId: topicRecord.id,
                language: detectedLanguage,
                ...(imageUrl ? { imageUrl } : {}),
              },
              create: {
                title: item.title,
                description,
                url: item.link,
                source: sourceConfig.name,
                sourceId: sourceRecord.id,
                language: detectedLanguage,
                imageUrl,
                topicId: topicRecord.id,
                publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
              },
            });
            totalStored++;
            sourceStored++;
            feedStored++;
          } catch {
            // Duplicate URL - skip
          }
        }
        console.log(`     ✓ fetched: ${items.length}, stored in DB: ${feedStored}`);
      } catch (err) {
        const msg = `Failed to fetch ${sourceConfig.name}: ${err instanceof Error ? err.message : "unknown"}`;
        console.error(`     ✗ ${msg}`);
        errors.push(msg);
      }
    }

    console.log(`[${sourceConfig.name}] Done — ${sourceFetched} fetched, ${sourceStored} stored`);
  }

  // -------------------------------------------------------------------------
  // Web scraping — supplements RSS with additional articles
  // -------------------------------------------------------------------------

  const scrapeTasks: Array<{
    name: string;
    slug: string;
    fn: () => Promise<ScrapedArticle[]>;
  }> = [
    { name: "Hetq (EN)", slug: "hetq", fn: () => scrapeHetq("en") },
    { name: "Hetq (HY)", slug: "hetq", fn: () => scrapeHetq("hy") },
    { name: "The Verge", slug: "theverge", fn: () => scrapeTheVerge() },
  ];

  for (const task of scrapeTasks) {
    console.log(`\n[Scraper: ${task.name}] Starting...`);
    const sourceRecord = sourceBySlug[task.slug];
    if (!sourceRecord) {
      console.log(`  ✗ Source "${task.slug}" not found in DB, skipping`);
      continue;
    }

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const articles = await task.fn();
      const recent = articles.filter((a) => a.publishedAt >= twentyFourHoursAgo);
      totalFetched += recent.length;

      let scraperStored = 0;
      for (const article of recent) {
        try {
          const topicSlug = classifyTopic(article.title, article.description);
          const topicRecord = topicBySlug[topicSlug] ?? topicBySlug["other"];
          if (!topicRecord) continue;

          const language =
            article.language ??
            detect([article.title, article.description].filter(Boolean).join(" ")) ??
            null;

          const imageUrl = await fetchOgImage(article.url);

          await prisma.article.upsert({
            where: { url: article.url },
            update: {
              topicId: topicRecord.id,
              language,
              ...(imageUrl ? { imageUrl } : {}),
            },
            create: {
              title: article.title,
              description: article.description,
              url: article.url,
              source: sourceRecord.name,
              sourceId: sourceRecord.id,
              language,
              imageUrl,
              topicId: topicRecord.id,
              publishedAt: article.publishedAt,
            },
          });
          totalStored++;
          scraperStored++;
        } catch {
          // Duplicate URL - skip
        }
      }
      console.log(`[Scraper: ${task.name}] Done — fetched: ${recent.length}, stored in DB: ${scraperStored}`);
    } catch (err) {
      const msg = `Scraper failed for ${task.name}: ${err instanceof Error ? err.message : "unknown"}`;
      console.error(`  ✗ ${msg}`);
      errors.push(msg);
    }
  }

  // Delete articles older than 24 hours
  await prisma.article.deleteMany({
    where: {
      publishedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  return { fetched: totalFetched, stored: totalStored, errors };
}

function extractImageUrl(item: Record<string, unknown>): string | null {
  const media = item["media:content"] as { $?: { url?: string } } | undefined;
  if (media?.$?.url) return media.$.url;

  const mediaThumbnail = item["media:thumbnail"] as { $?: { url?: string } } | undefined;
  if (mediaThumbnail?.$?.url) return mediaThumbnail.$.url;

  const enclosure = item.enclosure as { url?: string } | undefined;
  if (enclosure?.url) return enclosure.url;

  return null;
}
