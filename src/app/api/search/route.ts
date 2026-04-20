import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;

  if (!q) return NextResponse.json({ articles: [], hasMore: false });

  const [userTopics, userSources, userLanguages] = await Promise.all([
    prisma.userTopic.findMany({ where: { userId }, select: { topicId: true } }),
    prisma.userSource.findMany({ where: { userId }, select: { sourceId: true } }),
    prisma.userLanguage.findMany({ where: { userId }, select: { languageCode: true } }),
  ]);

  const topicIds = userTopics.map((ut) => ut.topicId);
  const sourceIds = userSources.map((us) => us.sourceId);
  const languageCodes = userLanguages.map((ul) => ul.languageCode);

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    publishedAt: { gte: twentyFourHoursAgo },
  };
  if (topicIds.length > 0) where.topicId = { in: topicIds };
  if (sourceIds.length > 0) where.sourceId = { in: sourceIds };
  if (languageCodes.length > 0) where.language = { in: languageCodes };

  // Use raw SQL for full-text search
  const offset = (page - 1) * limit;
  const safeQuery = q.replace(/'/g, "''");

  // Get matching article IDs using full-text search
  const ftsResults = await prisma.$queryRawUnsafe<{ id: string }[]>(`
    SELECT id FROM "Article"
    WHERE to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''))
      @@ plainto_tsquery('english', '${safeQuery}')
    AND "publishedAt" >= NOW() - INTERVAL '24 hours'
    ${topicIds.length > 0 ? `AND "topicId" IN (${topicIds.map((id) => `'${id}'`).join(",")})` : ""}
    ${sourceIds.length > 0 ? `AND "sourceId" IN (${sourceIds.map((id) => `'${id}'`).join(",")})` : ""}
    ${languageCodes.length > 0 ? `AND language IN (${languageCodes.map((c) => `'${c}'`).join(",")})` : ""}
    ORDER BY "publishedAt" DESC
    LIMIT ${limit + 1} OFFSET ${offset}
  `);

  const ids = ftsResults.map((r) => r.id);
  const hasMore = ids.length > limit;
  const pageIds = hasMore ? ids.slice(0, limit) : ids;

  if (pageIds.length === 0) return NextResponse.json({ articles: [], hasMore: false });

  const articles = await prisma.article.findMany({
    where: { id: { in: pageIds } },
    orderBy: { publishedAt: "desc" },
    include: { topic: { select: { name: true, slug: true } } },
  });

  return NextResponse.json({ articles, hasMore });
}
