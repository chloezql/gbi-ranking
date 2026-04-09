"use client";

import { useState, useMemo } from "react";
import type { Company, SortKey, CategoryInfo } from "@/lib/types";
import { CompanyCard } from "./CompanyCard";
import { cn } from "@/lib/utils";

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
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = companies;

    if (activeCategory !== "all") {
      result = result.filter((c) => c.parentCategorySlug === activeCategory);
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
  }, [companies, activeCategory, sortKey, search]);

  return (
    <div>
      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setActiveCategory("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
            activeCategory === "all"
              ? "bg-accent text-white"
              : "bg-card border border-border text-muted hover:text-foreground hover:border-accent/30"
          )}
        >
          All
          <span className="ml-1 text-xs opacity-70">{companies.length}</span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setActiveCategory(cat.slug)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              activeCategory === cat.slug
                ? "bg-accent text-white"
                : "bg-card border border-border text-muted hover:text-foreground hover:border-accent/30"
            )}
          >
            {cat.name}
            <span className="ml-1 text-xs opacity-70">{cat.count}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-4 mb-4 gap-4">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted hidden sm:inline">Sort:</span>
          <div className="flex bg-card border border-border rounded-lg overflow-hidden">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
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
      </div>

      {/* Results count */}
      <p className="text-xs text-muted mb-3">
        {filtered.length} companies
      </p>

      {/* Company list */}
      <div className="flex flex-col gap-2">
        {filtered.map((company, i) => (
          <CompanyCard key={company.domain} company={company} rank={i + 1} sortKey={sortKey} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted">
            <p className="text-lg">No companies found</p>
            <p className="text-sm mt-1">Try adjusting your filters or search term</p>
          </div>
        )}
      </div>
    </div>
  );
}
