import * as cheerio from "cheerio";

export interface ScrapedArticle {
  title: string;
  description: string | null;
  url: string;
  publishedAt: Date;
  language: string | null;
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Hetq
// Selector: a.news-item  →  h4 (title), time[datetime] (date)
// ---------------------------------------------------------------------------
export async function scrapeHetq(lang: "en" | "hy"): Promise<ScrapedArticle[]> {
  const baseUrl = "https://hetq.am";
  const html = await fetchHtml(`${baseUrl}/${lang}`);
  const $ = cheerio.load(html);
  const articles: ScrapedArticle[] = [];

  $("a.news-item").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).find("h4").text().trim();
    const datetime = $(el).find("time").attr("datetime");
    const description = $(el).find("p").first().text().trim() || null;

    if (!href || !title) return;

    articles.push({
      title,
      description,
      url: href.startsWith("http") ? href : `${baseUrl}${href}`,
      publishedAt: datetime ? new Date(datetime) : new Date(),
      language: lang === "hy" ? "hy" : "en",
    });
  });

  return articles;
}

// ---------------------------------------------------------------------------
// The Verge
// Extracts articles from the __NEXT_DATA__ JSON embedded in the page.
// ---------------------------------------------------------------------------

interface VergeEntry {
  title?: string;
  dek?: string;
  permalink?: string;
  publishDate?: string;
  publishedAt?: string;
}

function extractVergeEntries(obj: unknown, found: VergeEntry[] = []): VergeEntry[] {
  if (!obj || typeof obj !== "object") return found;
  if (Array.isArray(obj)) {
    for (const item of obj) extractVergeEntries(item, found);
    return found;
  }
  const record = obj as Record<string, unknown>;
  // An article entry has at minimum a title and a permalink
  if (
    typeof record.title === "string" &&
    typeof record.permalink === "string" &&
    record.permalink.startsWith("/")
  ) {
    found.push(record as VergeEntry);
  }
  for (const value of Object.values(record)) {
    extractVergeEntries(value, found);
  }
  return found;
}

export async function scrapeTheVerge(): Promise<ScrapedArticle[]> {
  const baseUrl = "https://www.theverge.com";
  const html = await fetchHtml(baseUrl);
  const $ = cheerio.load(html);

  const nextDataScript = $("#__NEXT_DATA__").html();
  if (!nextDataScript) throw new Error("__NEXT_DATA__ not found on The Verge");

  const json = JSON.parse(nextDataScript);
  const entries = extractVergeEntries(json);

  // Deduplicate by permalink
  const seen = new Set<string>();
  const articles: ScrapedArticle[] = [];

  for (const entry of entries) {
    if (!entry.title || !entry.permalink) continue;
    if (seen.has(entry.permalink)) continue;
    seen.add(entry.permalink);

    const rawDate = entry.publishDate ?? entry.publishedAt;
    articles.push({
      title: entry.title,
      description: entry.dek ?? null,
      url: `${baseUrl}${entry.permalink}`,
      publishedAt: rawDate ? new Date(rawDate) : new Date(),
      language: "en",
    });
  }

  return articles;
}
