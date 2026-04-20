import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [latest, totalCount] = await Promise.all([
    prisma.article.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.article.count(),
  ]);

  return NextResponse.json({
    lastFetchAt: latest?.createdAt?.toISOString() ?? null,
    totalCount,
  });
}
