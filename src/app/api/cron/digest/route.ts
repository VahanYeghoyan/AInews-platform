import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

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

  const emailHost = process.env.EMAIL_HOST;
  if (!emailHost) {
    console.log("[digest] No EMAIL_HOST configured, skipping email delivery");
    return NextResponse.json({ message: "No EMAIL_HOST configured, skipped", sent: 0 });
  }

  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get all users with their preferences
  const users = await prisma.user.findMany({
    include: {
      topics: { select: { topicId: true } },
      sources: { select: { sourceId: true } },
      languages: { select: { languageCode: true } },
    },
  });

  let sent = 0;

  for (const user of users) {
    const topicIds = user.topics.map((t) => t.topicId);
    if (topicIds.length === 0) continue;

    const where: Record<string, unknown> = {
      topicId: { in: topicIds },
      publishedAt: { gte: twentyFourHoursAgo },
    };

    const sourceIds = user.sources.map((s) => s.sourceId);
    const languageCodes = user.languages.map((l) => l.languageCode);
    if (sourceIds.length > 0) where.sourceId = { in: sourceIds };
    if (languageCodes.length > 0) where.language = { in: languageCodes };

    const articles = await prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: 5,
      include: { topic: { select: { name: true, slug: true } } },
    });

    if (articles.length === 0) continue;

    const articleRows = articles
      .map(
        (a) => `
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid #eee;">
          <a href="${a.url}" style="font-size:15px;font-weight:600;color:#1a1a2e;text-decoration:none;">${a.title}</a>
          <div style="font-size:12px;color:#6c757d;margin-top:4px;">${a.topic.name} &bull; ${new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
          ${a.description ? `<p style="font-size:13px;color:#333;margin:6px 0 0;">${a.description}</p>` : ""}
        </td>
      </tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a1a2e;padding:20px;border-radius:12px;margin-bottom:24px;">
    <span style="font-size:24px;font-weight:900;color:white;">Pulse</span>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:14px;">Your daily news digest</p>
  </div>
  <h2 style="font-size:20px;color:#1a1a2e;">Top stories for you</h2>
  <table style="width:100%;border-collapse:collapse;">${articleRows}</table>
  <p style="font-size:12px;color:#6c757d;margin-top:24px;text-align:center;">You are receiving this because you use Pulse news. Visit your feed for more stories.</p>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: user.email,
        subject: `Your Pulse digest - ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
        html,
      });
      sent++;
    } catch (err) {
      console.error(`[digest] Failed to send email to ${user.email}:`, err);
    }
  }

  return NextResponse.json({ message: `Digest sent to ${sent} users`, sent });
}
