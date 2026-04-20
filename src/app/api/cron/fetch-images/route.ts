import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchOgImage, withConcurrency } from "@/lib/og-fetcher";

export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (
    process.env.NODE_ENV !== "development" &&
    secret !== process.env.NEXTAUTH_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Process up to 50 articles per run to stay within time limits
  const articles = await prisma.article.findMany({
    where: { imageUrl: null },
    select: { id: true, url: true },
    take: 50,
  });

  if (articles.length === 0) {
    return NextResponse.json({ message: "No articles missing images", updated: 0 });
  }

  const tasks = articles.map((article) => async () => {
    const imageUrl = await fetchOgImage(article.url);
    if (imageUrl) {
      await prisma.article.update({
        where: { id: article.id },
        data: { imageUrl },
      });
      return true;
    }
    return false;
  });

  const results = await withConcurrency(tasks, 8);
  const updated = results.filter(Boolean).length;

  return NextResponse.json({
    message: "Image backfill complete",
    processed: articles.length,
    updated,
  });
}
