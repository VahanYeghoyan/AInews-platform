import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const [languages, userLanguages, articleCounts] = await Promise.all([
    prisma.language.findMany({ orderBy: { name: "asc" } }),
    prisma.userLanguage.findMany({ where: { userId }, select: { languageCode: true } }),
    prisma.article.groupBy({ by: ["language"], _count: { _all: true } }),
  ]);

  const selected = new Set(userLanguages.map((ul) => ul.languageCode));
  const countByLang = Object.fromEntries(
    articleCounts.map((r) => [r.language ?? "", r._count._all])
  );

  return NextResponse.json(
    languages.map((l) => ({
      ...l,
      selected: selected.has(l.code),
      articleCount: countByLang[l.code] ?? 0,
    }))
  );
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { languageCodes } = await req.json();

  if (!Array.isArray(languageCodes)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.userLanguage.deleteMany({ where: { userId } }),
    prisma.userLanguage.createMany({
      data: languageCodes.map((code: string) => ({ userId, languageCode: code })),
    }),
  ]);

  return NextResponse.json({ success: true });
}
