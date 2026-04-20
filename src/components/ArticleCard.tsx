"use client";

interface ArticleCardProps {
  id?: string;
  title: string;
  description: string | null;
  url: string;
  source: string | null;
  imageUrl: string | null;
  topicName: string;
  topicSlug: string;
  publishedAt: string;
  featured?: boolean;
  bookmarked?: boolean;
  onBookmarkToggle?: () => void;
}

const SOURCE_DOMAIN_MAP: Record<string, string> = {
  "BBC": "bbc.com",
  "NY Times": "nytimes.com",
  "The Verge": "theverge.com",
  "Civilnet": "civilnet.am",
  "Hetq": "hetq.am",
  "News.am": "news.am",
};

function getSourceDomain(source: string | null): string | null {
  if (!source) return null;
  if (SOURCE_DOMAIN_MAP[source]) return SOURCE_DOMAIN_MAP[source];
  // Try to extract domain from source name heuristically
  return null;
}

function getReadingTime(description: string | null): number {
  if (!description) return 1;
  const words = description.trim().split(/\s+/).length;
  return Math.max(1, Math.round((words * 8) / 200));
}

export default function ArticleCard({
  id,
  title,
  description,
  url,
  source,
  imageUrl,
  topicName,
  topicSlug,
  publishedAt,
  featured = false,
  bookmarked = false,
  onBookmarkToggle,
}: ArticleCardProps) {
  const timeAgo = getTimeAgo(new Date(publishedAt));
  const readingTime = getReadingTime(description);
  const sourceDomain = getSourceDomain(source);

  function handleClick() {
    if (id) {
      fetch(`/api/articles/${id}/click`, { method: "POST" }).catch(() => {});
    }
  }

  function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onBookmarkToggle?.();
  }

  if (featured) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="group relative block overflow-hidden rounded-2xl bg-[var(--color-nav)] shadow-xl transition-transform hover:scale-[1.01]"
      >
        {imageUrl && (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover opacity-40 transition-opacity group-hover:opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </div>
        )}
        {/* Bookmark button for featured */}
        {onBookmarkToggle && (
          <button
            onClick={handleBookmark}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
          >
            <svg className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          </button>
        )}
        <div className="relative flex min-h-[340px] flex-col justify-end p-8">
          <div className="mb-3 flex items-center gap-2">
            <span className={`topic-${topicSlug} rounded-full px-3 py-1 text-xs font-semibold`}>
              {topicName}
            </span>
            {source && (
              <span className="flex items-center gap-1 text-xs font-medium text-white/70">
                {sourceDomain && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=16`}
                    alt=""
                    width={16}
                    height={16}
                    className="rounded-sm"
                  />
                )}
                {source}
              </span>
            )}
            <span className="text-xs text-white/50">{readingTime} min read</span>
          </div>
          <h2 className="mb-2 text-2xl font-bold leading-tight text-white group-hover:text-[var(--color-primary)] transition-colors sm:text-3xl">
            {title}
          </h2>
          {description && (
            <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-white/70">
              {description}
            </p>
          )}
          <span className="text-xs text-white/50">{timeAgo}</span>
        </div>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="group relative flex flex-col overflow-hidden rounded-xl bg-[var(--color-surface)] shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md hover:ring-black/10"
    >
      {/* Bookmark button */}
      {onBookmarkToggle && (
        <button
          onClick={handleBookmark}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[var(--color-muted)] shadow-sm transition-colors hover:bg-white hover:text-[var(--color-primary)]"
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
        >
          <svg className="h-3.5 w-3.5" fill={bookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
        </button>
      )}

      {imageUrl ? (
        <div className="aspect-[16/10] w-full overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <div className={`topic-${topicSlug} rounded-full px-4 py-2 text-sm font-bold opacity-60`}>
            {topicName}
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2.5 flex items-center gap-2">
          <span className={`topic-${topicSlug} rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide`}>
            {topicName}
          </span>
          <span className="text-[11px] text-[var(--color-muted)]">{timeAgo}</span>
          <span className="text-[11px] text-[var(--color-muted)]">{readingTime} min read</span>
        </div>
        <h3 className="mb-1.5 text-[15px] font-semibold leading-snug text-[var(--color-foreground)] transition-colors group-hover:text-[var(--color-primary)]">
          {title}
        </h3>
        {description && (
          <p className="mb-3 line-clamp-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
            {description}
          </p>
        )}
        {source && (
          <div className="mt-auto flex items-center gap-1.5 pt-2">
            {sourceDomain && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=16`}
                alt=""
                width={16}
                height={16}
                className="rounded-sm"
              />
            )}
            <span className="text-[11px] font-medium text-[var(--color-muted)]">
              {source}
            </span>
          </div>
        )}
      </div>
    </a>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
