import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      article: {
        include: {
          topic: { select: { name: true, slug: true } },
        },
      },
    },
  });

  const articles = bookmarks.map((b) => ({
    ...b.article,
    publishedAt: b.article.publishedAt.toISOString(),
    createdAt: b.article.createdAt.toISOString(),
    bookmarked: true,
  }));

  return NextResponse.json({ articles });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { articleId } = await req.json();
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 });

  const bookmark = await prisma.bookmark.upsert({
    where: { userId_articleId: { userId, articleId } },
    create: { userId, articleId },
    update: {},
  });

  return NextResponse.json(bookmark, { status: 201 });
}
