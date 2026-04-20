"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ArticleCard from "@/components/ArticleCard";
import { Suspense } from "react";

interface Article {
  id: string;
  title: string;
  description: string | null;
  url: string;
  source: string | null;
  imageUrl: string | null;
  publishedAt: string;
  topic: { name: string; slug: string };
}

function SearchResults() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState(q);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchResults = useCallback(
    async (query: string, pageNum: number, append = false) => {
      if (!query.trim()) {
        setArticles([]);
        setHasMore(false);
        return;
      }
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&page=${pageNum}`
      );
      const data = await res.json();
      if (append) {
        setArticles((prev) => [...prev, ...(data.articles || [])]);
      } else {
        setArticles(data.articles || []);
      }
      setHasMore(data.hasMore || false);
    },
    []
  );

  useEffect(() => {
    if (status === "authenticated" && q) {
      setLoading(true);
      setPage(1);
      setSearchInput(q);
      fetchResults(q, 1).then(() => setLoading(false));
    }
  }, [q, status, fetchResults]);

  // Fetch bookmarks to show bookmark state
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/bookmarks")
        .then((r) => r.json())
        .then((data) => {
          const ids = (data.articles || []).map((a: Article) => a.id);
          setBookmarkedIds(new Set(ids));
        })
        .catch(() => {});
    }
  }, [status]);

  async function handleBookmarkToggle(articleId: string) {
    if (bookmarkedIds.has(articleId)) {
      await fetch(`/api/bookmarks/${articleId}`, { method: "DELETE" });
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        next.delete(articleId);
        return next;
      });
    } else {
      await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      setBookmarkedIds((prev) => new Set(prev).add(articleId));
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    await fetchResults(q, nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
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
            autoFocus
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-9 pr-4 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>
      </form>

      {/* Header */}
      {q && !loading && (
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--color-foreground)]">
            {articles.length} result{articles.length !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
          </h1>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="spinner" />
        </div>
      )}

      {/* No results */}
      {!loading && q && articles.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <svg className="h-12 w-12 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-[var(--color-muted)]">No articles found for &ldquo;{q}&rdquo;</p>
          <p className="text-sm text-[var(--color-muted)]">Try different keywords or check your topic/source filters.</p>
        </div>
      )}

      {/* Empty state - no query */}
      {!loading && !q && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <svg className="h-12 w-12 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-[var(--color-muted)]">Start typing to search articles</p>
        </div>
      )}

      {/* Results grid */}
      {!loading && articles.length > 0 && (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
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
                  "Load More"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="spinner" /></div>}>
      <SearchResults />
    </Suspense>
  );
}
