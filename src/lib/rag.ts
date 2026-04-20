import { prisma } from "./prisma";

interface RetrievedArticle {
  title: string;
  description: string | null;
  source: string | null;
  url: string;
  topicName: string;
  publishedAt: Date;
}

async function getUserFilters(userId: string) {
  const [userTopics, userSources, userLanguages] = await Promise.all([
    prisma.userTopic.findMany({ where: { userId }, select: { topicId: true } }),
    prisma.userSource.findMany({ where: { userId }, select: { sourceId: true } }),
    prisma.userLanguage.findMany({ where: { userId }, select: { languageCode: true } }),
  ]);

  return {
    topicIds: userTopics.map((ut) => ut.topicId),
    sourceIds: userSources.map((us) => us.sourceId),
    languageCodes: userLanguages.map((ul) => ul.languageCode),
  };
}

/**
 * Retrieve articles relevant to a query, scoped to the user's active filters
 * (topics, sources, languages) and last 24 hours only.
 */
export async function retrieveArticles(
  userId: string,
  query: string,
  limit = 5
): Promise<RetrievedArticle[]> {
  const { topicIds, sourceIds, languageCodes } = await getUserFilters(userId);
  if (topicIds.length === 0) return [];

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Build parameterized query dynamically
  const params: unknown[] = [topicIds, query, limit, twentyFourHoursAgo];
  const conditions: string[] = [
    `a."topicId" = ANY($1)`,
    `a."publishedAt" >= $4`,
    `to_tsvector('english', coalesce(a."title", '') || ' ' || coalesce(a."description", ''))
       @@ plainto_tsquery('english', $2)`,
  ];

  if (sourceIds.length > 0) {
    params.push(sourceIds);
    conditions.push(`a."sourceId" = ANY($${params.length})`);
  }
  if (languageCodes.length > 0) {
    params.push(languageCodes);
    conditions.push(`a."language" = ANY($${params.length})`);
  }

  const sql = `
    SELECT
      a."title",
      a."description",
      a."source",
      a."url",
      t."name" as "topicName",
      a."publishedAt"
    FROM "Article" a
    JOIN "Topic" t ON a."topicId" = t."id"
    WHERE ${conditions.join("\n      AND ")}
    ORDER BY
      ts_rank(
        to_tsvector('english', coalesce(a."title", '') || ' ' || coalesce(a."description", '')),
        plainto_tsquery('english', $2)
      ) DESC,
      a."publishedAt" DESC
    LIMIT $3
  `;

  return prisma.$queryRawUnsafe<RetrievedArticle[]>(sql, ...params);
}

/**
 * Fallback: return recent articles scoped to the user's active filters and last 24 hours.
 */
export async function getRecentArticles(
  userId: string,
  limit = 5
): Promise<RetrievedArticle[]> {
  const { topicIds, sourceIds, languageCodes } = await getUserFilters(userId);
  if (topicIds.length === 0) return [];

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    topicId: { in: topicIds },
    publishedAt: { gte: twentyFourHoursAgo },
  };
  if (sourceIds.length > 0) where.sourceId = { in: sourceIds };
  if (languageCodes.length > 0) where.language = { in: languageCodes };

  const articles = await prisma.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: { topic: { select: { name: true } } },
  });

  return articles.map((a) => ({
    title: a.title,
    description: a.description,
    source: a.source,
    url: a.url,
    topicName: a.topic.name,
    publishedAt: a.publishedAt,
  }));
}

/**
 * Format retrieved articles into context for the LLM.
 */
export function formatContext(articles: RetrievedArticle[]): string {
  if (articles.length === 0) {
    return "No relevant articles found in the user's feed.";
  }

  return articles
    .map(
      (a, i) =>
        `[${i + 1}] "${a.title}" (${a.topicName} - ${a.source || "Unknown"}, ${a.publishedAt.toLocaleDateString()})\n${a.description || "No description."}\nURL: ${a.url}`
    )
    .join("\n\n");
}
