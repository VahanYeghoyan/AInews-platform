import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const results = await prisma.$queryRaw<
    {
      id: string;
      title: string;
      description: string | null;
      url: string;
      source: string | null;
      imageUrl: string | null;
      publishedAt: Date;
      createdAt: Date;
      language: string | null;
      topicId: string;
      topicName: string;
      topicSlug: string;
      clickCount: bigint;
    }[]
  >`
    SELECT
      a.id,
      a.title,
      a.description,
      a.url,
      a.source,
      a."imageUrl",
      a."publishedAt",
      a."createdAt",
      a.language,
      a."topicId",
      t.name AS "topicName",
      t.slug AS "topicSlug",
      COUNT(ac.id) AS "clickCount"
    FROM "Article" a
    JOIN "Topic" t ON t.id = a."topicId"
    LEFT JOIN "ArticleClick" ac ON ac."articleId" = a.id
      AND ac."clickedAt" >= ${twentyFourHoursAgo}
    WHERE a."publishedAt" >= ${twentyFourHoursAgo}
    GROUP BY a.id, t.id
    ORDER BY "clickCount" DESC, a."publishedAt" DESC
    LIMIT 20
  `;

  const articles = results.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    url: r.url,
    source: r.source,
    imageUrl: r.imageUrl,
    publishedAt: r.publishedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    language: r.language,
    topicId: r.topicId,
    topic: { name: r.topicName, slug: r.topicSlug },
    clickCount: Number(r.clickCount),
  }));

  return NextResponse.json({ articles });
}
