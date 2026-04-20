"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Language {
  code: string;
  name: string;
  selected: boolean;
  articleCount: number;
}

const LANGUAGE_META: Record<string, { icon: string; gradient: string; flag: string }> = {
  en: { icon: "en", gradient: "from-blue-600 to-indigo-700", flag: "🇬🇧" },
  hy: { icon: "hy", gradient: "from-red-500 to-orange-600",  flag: "🇦🇲" },
};

export default function LanguagesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/languages")
        .then((r) => r.json())
        .then((data) => {
          setLanguages(data);
          setLoading(false);
        });
    }
  }, [status, router]);

  function toggleLanguage(code: string) {
    setLanguages((prev) =>
      prev.map((l) => (l.code === code ? { ...l, selected: !l.selected } : l))
    );
  }

  async function handleSave() {
    setSaving(true);
    const selectedCodes = languages.filter((l) => l.selected).map((l) => l.code);

    await fetch("/api/languages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languageCodes: selectedCodes }),
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

  const selectedCount = languages.filter((l) => l.selected).length;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
          Choose your languages
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Only articles from sources in your selected languages will appear in your feed.
          Selecting none shows all languages.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {languages.map((lang) => {
          const meta = LANGUAGE_META[lang.code] ?? {
            gradient: "from-gray-500 to-slate-600",
            flag: "🌐",
          };
          return (
            <button
              key={lang.code}
              onClick={() => toggleLanguage(lang.code)}
              className={`group relative flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all duration-200 ${
                lang.selected
                  ? "border-transparent bg-gradient-to-br shadow-lg " +
                    meta.gradient +
                    " scale-[1.03] text-white"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              {lang.selected && (
                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/30">
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              )}
              <span className="text-4xl">{meta.flag}</span>
              <span className="text-sm font-semibold">{lang.name}</span>
              <span className={`text-xs ${lang.selected ? "text-white/70" : "text-[var(--color-muted)]"}`}>
                {lang.articleCount.toLocaleString()} articles
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex items-center justify-between rounded-2xl bg-[var(--color-surface)] px-6 py-4 shadow-sm ring-1 ring-black/5">
        <p className="text-sm text-[var(--color-muted)]">
          {selectedCount === 0 ? (
            "All languages shown (none selected)"
          ) : (
            <>
              <span className="font-semibold text-[var(--color-foreground)]">{selectedCount}</span>{" "}
              language{selectedCount !== 1 ? "s" : ""} selected
            </>
          )}
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40"
        >
          {saving ? "Saving..." : "Continue to Feed"}
        </button>
      </div>
    </div>
  );
}
