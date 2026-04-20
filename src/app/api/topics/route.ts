import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/topics - list all topics with user's selections
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const topics = await prisma.topic.findMany({
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

  const result = topics.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    selected: t.users.length > 0,
    articleCount: t._count.articles,
  }));

  return NextResponse.json(result);
}

// PUT /api/topics - update user's selected topics
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { topicIds } = await req.json();

  if (!Array.isArray(topicIds)) {
    return NextResponse.json(
      { error: "topicIds must be an array" },
      { status: 400 }
    );
  }

  // Remove all existing selections, then add new ones
  await prisma.$transaction([
    prisma.userTopic.deleteMany({ where: { userId } }),
    ...topicIds.map((topicId: string) =>
      prisma.userTopic.create({ data: { userId, topicId } })
    ),
  ]);

  return NextResponse.json({ success: true });
}
