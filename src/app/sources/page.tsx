"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Source {
  id: string;
  slug: string;
  name: string;
  selected: boolean;
  articleCount: number;
}

const SOURCE_META: Record<string, { icon: string; gradient: string; region: string }> = {
  nytimes:    { icon: "newspaper",  gradient: "from-gray-700 to-gray-900",    region: "International" },
  bbc:        { icon: "globe",      gradient: "from-red-600 to-red-800",      region: "International" },
  theverge:   { icon: "bolt",       gradient: "from-purple-500 to-violet-600", region: "International" },
  civilnet:   { icon: "flag",       gradient: "from-orange-500 to-amber-600",  region: "Armenia" },
  hetq:       { icon: "search",     gradient: "from-blue-600 to-indigo-700",   region: "Armenia" },
  newsam:     { icon: "rss",        gradient: "from-emerald-500 to-teal-600",  region: "Armenia" },
};

function SourceIcon({ slug }: { slug: string }) {
  const meta = SOURCE_META[slug];
  const iconName = meta?.icon || "newspaper";

  const icons: Record<string, React.ReactNode> = {
    newspaper: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
      </svg>
    ),
    globe: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    bolt: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    flag: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
      </svg>
    ),
    search: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
rss: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 19.5v-.75a7.5 7.5 0 00-7.5-7.5H4.5m0 0v-.75a11.25 11.25 0 0111.25-11.25h.75m-12 12h.008v.008H4.5v-.008zm0 0H3.75m.75 0h-.008v-.008H4.5v.008zM6 19.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  };

  return <>{icons[iconName]}</>;
}

export default function SourcesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/sources")
        .then((r) => r.json())
        .then((data) => {
          setSources(data);
          setLoading(false);
        });
    }
  }, [status, router]);

  function toggleSource(id: string) {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  }

  async function handleSave() {
    setSaving(true);
    const selectedIds = sources.filter((s) => s.selected).map((s) => s.id);

    await fetch("/api/sources", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceIds: selectedIds }),
    });

    setSaving(false);
    router.push("/feed");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  const selectedCount = sources.filter((s) => s.selected).length;
  const regions = [...new Set(Object.values(SOURCE_META).map((m) => m.region))];

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
          Choose your sources
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Select the news outlets you want to follow. Your feed will only show articles from these sources.
        </p>
      </div>

      {regions.map((region) => {
        const regionSources = sources.filter(
          (s) => SOURCE_META[s.slug]?.region === region
        );
        if (regionSources.length === 0) return null;

        return (
          <div key={region} className="mb-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {region}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {regionSources.map((source) => {
                const meta = SOURCE_META[source.slug] || {
                  gradient: "from-gray-500 to-slate-400",
                };
                return (
                  <button
                    key={source.id}
                    onClick={() => toggleSource(source.id)}
                    className={`group relative flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all duration-200 ${
                      source.selected
                        ? "border-transparent bg-gradient-to-br shadow-lg " + meta.gradient + " scale-[1.03] text-white"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    {source.selected && (
                      <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/30">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                    )}
                    <SourceIcon slug={source.slug} />
                    <span className="text-sm font-semibold">{source.name}</span>
                    <span className={`text-xs ${source.selected ? "text-white/70" : "text-[var(--color-muted)]"}`}>
                      {source.articleCount.toLocaleString()} articles
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="mt-10 flex items-center justify-between rounded-2xl bg-[var(--color-surface)] px-6 py-4 shadow-sm ring-1 ring-black/5">
        <p className="text-sm text-[var(--color-muted)]">
          <span className="font-semibold text-[var(--color-foreground)]">{selectedCount}</span>{" "}
          source{selectedCount !== 1 ? "s" : ""} selected
        </p>
        <button
          onClick={handleSave}
          disabled={saving || selectedCount === 0}
          className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40"
        >
          {saving ? "Saving..." : "Continue to Feed"}
        </button>
      </div>
    </div>
  );
}
