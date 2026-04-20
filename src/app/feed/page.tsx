"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import Link from "next/link";

interface Article {
  id: string;
  title: string;
  description: string | null;
  url: string;
  source: string | null;
  imageUrl: string | null;
  publishedAt: string;
  topic: { name: string; slug: string };
  clickCount?: number;
}

type Tab = "feed" | "trending" | "bookmarks";

function getTimeAgoShort(isoString: string | null): string {
  if (!isoString) return "";
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function FeedPage() {
  const { status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("feed");
  const [searchInput, setSearchInput] = useState("");

  // Feed tab state
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Trending tab state
  const [trending, setTrending] = useState<Article[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  // Bookmarks tab state
  const [bookmarks, setBookmarks] = useState<Article[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);

  // Track which articles are bookmarked (by id)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const fetchArticles = useCallback(async (pageNum: number, append = false) => {
    const res = await fetch(`/api/feed?page=${pageNum}`);
    const data = await res.json();
    if (append) {
      setArticles((prev) => [...prev, ...(data.articles || [])]);
    } else {
      setArticles(data.articles || []);
    }
    setHasMore(data.hasMore);
  }, []);

  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/system/status");
      const data = await res.json();
      setLastFetchAt(data.lastFetchAt);
      setTotalCount(data.totalCount ?? null);
    } catch {
      // ignore
    }
  }, []);

  const fetchBookmarks = useCallback(async () => {
    setBookmarksLoading(true);
    try {
      const res = await fetch("/api/bookmarks");
      const data = await res.json();
      const articles = data.articles || [];
      setBookmarks(articles);
      setBookmarkedIds(new Set(articles.map((a: Article) => a.id)));
    } catch {
      // ignore
    } finally {
      setBookmarksLoading(false);
    }
  }, []);

  const fetchTrending = useCallback(async () => {
    setTrendingLoading(true);
    try {
      const res = await fetch("/api/trending");
      const data = await res.json();
      setTrending(data.articles || []);
    } catch {
      // ignore
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      Promise.all([fetchArticles(1), fetchSystemStatus(), fetchBookmarks()]).then(() =>
        setLoading(false)
      );
    }
  }, [status, router, fetchArticles, fetchSystemStatus, fetchBookmarks]);

  useEffect(() => {
    if (tab === "trending" && trending.length === 0) {
      fetchTrending();
    }
  }, [tab, trending.length, fetchTrending]);

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    await fetchArticles(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  }

  async function handleBookmarkToggle(articleId: string) {
    if (bookmarkedIds.has(articleId)) {
      // Remove
      await fetch(`/api/bookmarks/${articleId}`, { method: "DELETE" });
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        next.delete(articleId);
        return next;
      });
      setBookmarks((prev) => prev.filter((a) => a.id !== articleId));
    } else {
      // Add
      await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      setBookmarkedIds((prev) => new Set(prev).add(articleId));
      // Add to bookmarks list if we know the article
      const article =
        articles.find((a) => a.id === articleId) ||
        trending.find((a) => a.id === articleId);
      if (article) {
        setBookmarks((prev) => [article, ...prev.filter((a) => a.id !== articleId)]);
      }
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
            Your Feed
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {lastFetchAt
              ? `Updated ${getTimeAgoShort(lastFetchAt)} · Refreshes ~every 2 hours`
              : "Latest stories from your selected topics"}
            {totalCount !== null && (
              <span className="ml-2 inline-flex items-center rounded-full bg-[var(--color-border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-foreground)]">
                {totalCount.toLocaleString()} articles in DB
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/topics"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:border-gray-400 hover:text-[var(--color-foreground)]"
          >
            Edit Topics
          </Link>
          <Link
            href="/sources"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:border-gray-400 hover:text-[var(--color-foreground)]"
          >
            Edit Sources
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="mb-6">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search articles..."
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-4 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>
      </form>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <TabButton active={tab === "feed"} onClick={() => setTab("feed")}>
          For You
        </TabButton>
        <TabButton active={tab === "trending"} onClick={() => setTab("trending")}>
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            Trending
          </span>
        </TabButton>
        <TabButton active={tab === "bookmarks"} onClick={() => setTab("bookmarks")}>
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill={tab === "bookmarks" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            Bookmarks
            {bookmarkedIds.size > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[10px] font-bold text-white">
                {bookmarkedIds.size}
              </span>
            )}
          </span>
        </TabButton>
      </div>

      {/* Feed tab */}
      {tab === "feed" && (
        <>
          {articles.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-hover)]">
                <svg className="h-8 w-8 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-[var(--color-foreground)]">Your feed is empty</h2>
              <p className="mt-1 text-center text-sm text-[var(--color-muted)]">
                {lastFetchAt
                  ? `Last fetched ${getTimeAgoShort(lastFetchAt)}. News refreshes approximately every 2 hours.`
                  : "Select some topics to start seeing personalized news."}
              </p>
              <Link
                href="/topics"
                className="mt-5 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
              >
                Choose Topics
              </Link>
            </div>
          ) : (
            <>
              {/* Featured */}
              <div className="mb-8">
                <ArticleCard
                  id={articles[0].id}
                  title={articles[0].title}
                  description={articles[0].description}
                  url={articles[0].url}
                  source={articles[0].source}
                  imageUrl={articles[0].imageUrl}
                  topicName={articles[0].topic.name}
                  topicSlug={articles[0].topic.slug}
                  publishedAt={articles[0].publishedAt}
                  featured
                  bookmarked={bookmarkedIds.has(articles[0].id)}
                  onBookmarkToggle={() => handleBookmarkToggle(articles[0].id)}
                />
              </div>

              {/* Grid */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {articles.slice(1).map((article) => (
                  <ArticleCard
                    key={article.id}
                    id={article.id}
                    title={article.title}
                    description={article.description}
                    url={article.url}
                    source={article.source}
                    imageUrl={article.imageUrl}
                    topicName={article.topic.name}
                    topicSlug={article.topic.slug}
                    publishedAt={article.publishedAt}
                    bookmarked={bookmarkedIds.has(article.id)}
                    onBookmarkToggle={() => handleBookmarkToggle(article.id)}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="mt-10 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-3 text-sm font-semibold text-[var(--color-foreground)] shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <div className="spinner !h-4 !w-4 !border-2" />
                        Loading...
                      </span>
                    ) : (
                      "Load More Articles"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Trending tab */}
      {tab === "trending" && (
        <>
          {trendingLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="spinner" />
            </div>
          ) : trending.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center">
              <p className="text-[var(--color-muted)]">No trending articles right now.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {trending.map((article) => (
                <ArticleCard
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  description={article.description}
                  url={article.url}
                  source={article.source}
                  imageUrl={article.imageUrl}
                  topicName={article.topic.name}
                  topicSlug={article.topic.slug}
                  publishedAt={article.publishedAt}
                  bookmarked={bookmarkedIds.has(article.id)}
                  onBookmarkToggle={() => handleBookmarkToggle(article.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Bookmarks tab */}
      {tab === "bookmarks" && (
        <>
          {bookmarksLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="spinner" />
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
              <svg className="h-12 w-12 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
              <p className="text-[var(--color-muted)]">No bookmarks yet.</p>
              <p className="text-sm text-[var(--color-muted)]">Tap the bookmark icon on any article to save it here.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {bookmarks.map((article) => (
                <ArticleCard
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  description={article.description}
                  url={article.url}
                  source={article.source}
                  imageUrl={article.imageUrl}
                  topicName={article.topic.name}
                  topicSlug={article.topic.slug}
                  publishedAt={article.publishedAt}
                  bookmarked={true}
                  onBookmarkToggle={() => handleBookmarkToggle(article.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-white shadow-sm"
          : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      }`}
    >
      {children}
    </button>
  );
}
