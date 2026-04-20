import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;

  // Get user's selected topic IDs, source IDs, and language codes
  const [userTopics, userSources, userLanguages] = await Promise.all([
    prisma.userTopic.findMany({
      where: { userId },
      select: { topicId: true },
    }),
    prisma.userSource.findMany({
      where: { userId },
      select: { sourceId: true },
    }),
    prisma.userLanguage.findMany({
      where: { userId },
      select: { languageCode: true },
    }),
  ]);

  const topicIds = userTopics.map((ut) => ut.topicId);
  const sourceIds = userSources.map((us) => us.sourceId);
  const languageCodes = userLanguages.map((ul) => ul.languageCode);

  if (topicIds.length === 0) {
    return NextResponse.json({ articles: [], hasMore: false });
  }

  // Build article filters — only last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where: Record<string, unknown> = {
    topicId: { in: topicIds },
    publishedAt: { gte: twentyFourHoursAgo },
  };
  if (sourceIds.length > 0) {
    where.sourceId = { in: sourceIds };
  }
  if (languageCodes.length > 0) {
    where.language = { in: languageCodes };
  }

  const articles = await prisma.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    skip: (page - 1) * limit,
    take: limit + 1,
    include: { topic: { select: { name: true, slug: true } } },
  });

  const hasMore = articles.length > limit;
  if (hasMore) articles.pop();

  return NextResponse.json({ articles, hasMore });
}
