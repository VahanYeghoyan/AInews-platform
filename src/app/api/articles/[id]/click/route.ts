import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.articleClick.create({
      data: { articleId: id },
    });
  } catch {
    // Article might not exist, ignore errors
  }

  return NextResponse.json({ success: true });
}
