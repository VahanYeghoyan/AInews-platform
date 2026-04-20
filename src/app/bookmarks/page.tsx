"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";

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

export default function BookmarksPage() {
  const { status } = useSession();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/bookmarks")
        .then((r) => r.json())
        .then((data) => {
          setArticles(data.articles || []);
          setLoading(false);
        });
    }
  }, [status, router]);

  async function handleRemoveBookmark(articleId: string) {
    await fetch(`/api/bookmarks/${articleId}`, { method: "DELETE" });
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
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
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
            Bookmarks
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {articles.length} saved article{articles.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-hover)]">
            <svg className="h-8 w-8 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]">No bookmarks yet</h2>
          <p className="text-center text-sm text-[var(--color-muted)]">
            Tap the bookmark icon on any article to save it for later.
          </p>
          <button
            onClick={() => router.push("/feed")}
            className="rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
          >
            Browse Feed
          </button>
        </div>
      ) : (
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
              bookmarked={true}
              onBookmarkToggle={() => handleRemoveBookmark(article.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
