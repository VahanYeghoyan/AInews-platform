import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/sources - list all sources with user's selections
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const sources = await prisma.source.findMany({
    orderBy: { name: "asc" },
    include: {
      users: {
        where: { userId },
        select: { userId: true },
      },
      _count: {
        select: {
          articles: { where: { publishedAt: { gte: twentyFourHoursAgo } } },
        },
      },
    },
  });

  const result = sources.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    selected: s.users.length > 0,
    articleCount: s._count.articles,
  }));

  return NextResponse.json(result);
}

// PUT /api/sources - update user's selected sources
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { sourceIds } = await req.json();

  if (!Array.isArray(sourceIds)) {
    return NextResponse.json(
      { error: "sourceIds must be an array" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.userSource.deleteMany({ where: { userId } }),
    ...sourceIds.map((sourceId: string) =>
      prisma.userSource.create({ data: { userId, sourceId } })
    ),
  ]);

  return NextResponse.json({ success: true });
}
