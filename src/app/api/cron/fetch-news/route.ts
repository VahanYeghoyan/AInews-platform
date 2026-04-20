import { NextResponse } from "next/server";
import { fetchAndStoreNews } from "@/lib/news-fetcher";

export const maxDuration = 60; // allow up to 60s for fetching

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  // Allow access with secret OR in development mode
  if (
    process.env.NODE_ENV !== "development" &&
    secret !== process.env.NEXTAUTH_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await fetchAndStoreNews();
    return NextResponse.json({
      message: "News fetched successfully",
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
