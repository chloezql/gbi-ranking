"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { Company, SortKey, CategoryInfo } from "@/lib/types";
import { CompanyCard } from "./CompanyCard";
import { cn, countryName } from "@/lib/utils";
import { Dropdown } from "./Dropdown";

function CategoryBar({
  categories,
  totalCount,
  activeCategory,
  onSelect,
}: {
  categories: CategoryInfo[];
  totalCount: number;
  activeCategory: string;
  onSelect: (slug: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  return (
    <div className="relative group">
      {/* Left fade + arrow */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-200",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      />
      {canScrollLeft && (
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted hover:text-foreground transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Scrollable area */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto py-1 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        <button
          onClick={() => onSelect("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
            activeCategory === "all"
              ? "bg-accent text-white shadow-sm"
              : "bg-card border border-border text-muted hover:text-foreground hover:border-accent/30"
          )}
        >
          All
          <span className="ml-1 text-xs opacity-70">{totalCount}</span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => onSelect(cat.slug)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
              activeCategory === cat.slug
                ? "bg-accent text-white shadow-sm"
                : "bg-card border border-border text-muted hover:text-foreground hover:border-accent/30"
            )}
          >
            {cat.name}
            <span className="ml-1 text-xs opacity-70">{cat.count}</span>
          </button>
        ))}
      </div>

      {/* Right fade + arrow */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-200",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
      />
      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted hover:text-foreground transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SearchToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  return (
    <div className="flex items-center">
      {expanded ? (
        <div className="relative animate-[fadeIn_0.15s_ease-out]">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => { if (!value) setExpanded(false); }}
            className="w-40 sm:w-48 pl-7 pr-2 py-1.5 bg-card border border-border rounded-lg text-xs focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
          />
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-card border border-border transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "visits", label: "Visits" },
  { key: "growthRate", label: "Growth" },
];

export function RankingList({
  companies,
  categories,
}: {
  companies: Company[];
  categories: CategoryInfo[];
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [originCountry, setOriginCountry] = useState<string>("all");
  const [targetMarket, setTargetMarket] = useState<string>("US");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const originOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of companies) {
      if (!c.originCountry) continue;
      map.set(c.originCountry, (map.get(c.originCountry) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([code, count]) => ({ code, name: countryName(code), count }))
      .sort((a, b) => b.count - a.count);
  }, [companies]);

  const targetOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of companies) {
      const top = c.topCountryShares[0];
      if (!top?.countryCode) continue;
      map.set(top.countryCode, (map.get(top.countryCode) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([code, count]) => ({ code, name: countryName(code), count }))
      .sort((a, b) => b.count - a.count);
  }, [companies]);

  const filtered = useMemo(() => {
    let result = companies;

    if (activeCategory === "_others") {
      result = result.filter((c) => otherSlugs.has(c.parentCategorySlug));
    } else if (activeCategory !== "all") {
      result = result.filter((c) => c.parentCategorySlug === activeCategory);
    }

    if (originCountry !== "all") {
      result = result.filter((c) => c.originCountry === originCountry);
    }

    if (targetMarket !== "all") {
      result = result.filter(
        (c) => c.topCountryShares[0]?.countryCode === targetMarket
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.domain.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case "score":
          return b.score - a.score;
        case "visits":
          return b.visits - a.visits;
        case "growthRate":
          return b.growthRate - a.growthRate;
      }
    });

    return result;
  }, [companies, activeCategory, originCountry, targetMarket, sortKey, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startRank = (page - 1) * PAGE_SIZE;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeCategory, originCountry, targetMarket, sortKey, search]);

  const categoryOptions = useMemo(() => {
    const isOther = (c: CategoryInfo) => c.count < 10 || c.slug === "other";
    const main = categories.filter((c) => !isOther(c));
    const othersCount = categories.filter(isOther).reduce((sum, c) => sum + c.count, 0);
    const result = [...main];
    if (othersCount > 0) {
      result.push({ slug: "_others", name: "Others", count: othersCount });
    }
    return result;
  }, [categories]);

  const otherSlugs = useMemo(() => {
    const isOther = (c: CategoryInfo) => c.count < 10 || c.slug === "other";
    return new Set(categories.filter(isOther).map((c) => c.slug));
  }, [categories]);

  return (
    <div>
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
        {/* Category */}
        <Dropdown
          label="Category"
          value={activeCategory}
          options={[
            { value: "all", label: "All" },
            ...categoryOptions.map((c) => ({ value: c.slug, label: c.name })),
          ]}
          onChange={setActiveCategory}
        />

        {/* Origin */}
        <Dropdown
          label="Origin"
          value={originCountry}
          options={[
            { value: "all", label: "All" },
            ...originOptions.map((c) => ({ value: c.code, label: c.name || c.code })),
          ]}
          onChange={setOriginCountry}
        />

        {/* Target Market */}
        <Dropdown
          label="Market"
          value={targetMarket}
          options={[
            { value: "all", label: "All" },
            ...targetOptions.map((c) => ({ value: c.code, label: c.name || c.code })),
          ]}
          onChange={setTargetMarket}
        />

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">Sort:</span>
          <div className="flex bg-card border border-border rounded-lg overflow-hidden">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium transition-colors",
                  sortKey === opt.key
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <SearchToggle value={search} onChange={setSearch} />
      </div>

      {/* Results count */}
      <p className="text-xs text-muted mb-3">
        {filtered.length} companies · Page {page} of {totalPages || 1}
      </p>

      {/* Company list */}
      <div className="flex flex-col gap-2">
        {paged.map((company, i) => (
          <CompanyCard key={company.domain} company={company} rank={startRank + i + 1} sortKey={sortKey} eager={i < 10} />
        ))}
        {paged.length === 0 && (
          <div className="text-center py-16 text-muted">
            <p className="text-lg">No companies found</p>
            <p className="text-sm mt-1">Try adjusting your filters or search term</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={page <= 1}
            className={cn(
              "flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              page <= 1
                ? "text-muted/40 cursor-not-allowed"
                : "bg-card border border-border text-foreground hover:border-accent/30"
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1 text-muted text-sm">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={cn(
                      "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                      page === p
                        ? "bg-accent text-white"
                        : "text-muted hover:text-foreground hover:bg-card"
                    )}
                  >
                    {p}
                  </button>
                )
              )}
          </div>

          <button
            onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={page >= totalPages}
            className={cn(
              "flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              page >= totalPages
                ? "text-muted/40 cursor-not-allowed"
                : "bg-card border border-border text-foreground hover:border-accent/30"
            )}
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
