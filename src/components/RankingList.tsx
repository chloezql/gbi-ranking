"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Company, CategoryInfo } from "@/lib/types";
import { CompanyCard } from "./CompanyCard";
import { cn, countryName } from "@/lib/utils";
import { Dropdown } from "./Dropdown";

type RankingMode = "market" | "growing" | "visited" | "engagement";

const MODES: { id: RankingMode; label: string }[] = [
  { id: "market", label: "Best in Market" },
  { id: "growing", label: "Fastest Growing" },
  { id: "visited", label: "Most Visited" },
  { id: "engagement", label: "Top Engagement" },
];

const STORAGE_MODE = "gbi-featured-mode";
const TOP_PREVIEW = 10;

const NEW_RETAIL_SLUG = "_new_retail";
const NEW_RETAIL_MEMBERS = ["e-commerce_and_shopping", "lifestyle"];
const NEW_RETAIL_MEMBER_SET = new Set(NEW_RETAIL_MEMBERS);

function getMarketShare(company: Company, code: string) {
  if (code === "all") return 1;
  return company.topCountryShares.find((s) => s.countryCode === code)?.value ?? 0;
}

function getPrimaryMarket(company: Company): string | null {
  let topCode: string | null = null;
  let topValue = -Infinity;
  for (const s of company.topCountryShares) {
    if (s.countryCode && s.value > topValue) {
      topCode = s.countryCode;
      topValue = s.value;
    }
  }
  return topCode;
}

const MARKET_VISITS_THRESHOLD = 3000;
const ALL_MARKETS_VISITS_THRESHOLD = 500;

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
            className="w-44 sm:w-56 pl-9 pr-3 py-2 bg-card border border-border rounded-full text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
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
          aria-label="Search"
          className="w-10 h-10 flex items-center justify-center rounded-full text-muted hover:text-foreground hover:border-accent/40 bg-card border border-border transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}

function MarketDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { code: string; name: string }[];
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.code === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const GlobeIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </svg>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Market"
        className={cn(
          "flex items-center gap-2 min-w-[150px] pl-3 pr-8 py-2 bg-card border rounded-full text-sm font-medium text-foreground transition-colors",
          open ? "border-accent/50 ring-1 ring-accent/20" : "border-border hover:border-accent/40"
        )}
      >
        {value !== "all" && selected ? (
          <img
            src={`https://flagcdn.com/w40/${value.toLowerCase()}.png`}
            alt=""
            className="w-5 h-3.5 object-cover rounded-[2px] border border-border/50 shrink-0"
          />
        ) : (
          <span className="text-muted flex items-center shrink-0">{GlobeIcon}</span>
        )}
        <span className="truncate">{selected?.name || "All Markets"}</span>
        <svg
          className={cn("absolute right-2.5 w-3.5 h-3.5 text-muted transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 min-w-full max-w-72 max-h-60 overflow-y-auto bg-card border border-border rounded-xl shadow-lg py-1.5 animate-[fadeIn_0.15s_ease-out]">
          <button
            onClick={() => { onChange("all"); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
              value === "all" ? "bg-accent/10 text-accent font-medium" : "text-foreground hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <span className="w-5 h-3.5 shrink-0" aria-hidden />
            All Markets
          </button>
          {options.map((opt) => (
            <button
              key={opt.code}
              onClick={() => { onChange(opt.code); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
                opt.code === value ? "bg-accent/10 text-accent font-medium" : "text-foreground hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <img
                src={`https://flagcdn.com/w40/${opt.code.toLowerCase()}.png`}
                alt=""
                className="w-5 h-3.5 object-cover rounded-[2px] border border-border/50 shrink-0"
              />
              <span className="truncate">{opt.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [mode, setMode] = useState<RankingMode>("market");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MODE) as RankingMode | null;
      if (saved && MODES.some((m) => m.id === saved)) setMode(saved);
    } catch {
      // ignore
    }
  }, []);

  const setModePersist = (m: RankingMode) => {
    setMode(m);
    try {
      localStorage.setItem(STORAGE_MODE, m);
    } catch {
      // ignore
    }
  };

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
      for (const share of c.topCountryShares) {
        if (!share.countryCode) continue;
        if (c.visits * share.value >= MARKET_VISITS_THRESHOLD) {
          map.set(share.countryCode, (map.get(share.countryCode) || 0) + 1);
        }
      }
    }
    return Array.from(map.entries())
      .map(([code, count]) => ({ code, name: countryName(code) || code, count }))
      .sort((a, b) => b.count - a.count);
  }, [companies]);

  const otherSlugs = useMemo(() => {
    const isOther = (c: CategoryInfo) => c.count < 10 || c.slug === "other";
    return new Set(categories.filter(isOther).map((c) => c.slug));
  }, [categories]);

  const filtered = useMemo(() => {
    let result = companies;

    if (activeCategory === "_others") {
      result = result.filter((c) => otherSlugs.has(c.parentCategorySlug));
    } else if (activeCategory === NEW_RETAIL_SLUG) {
      result = result.filter((c) => NEW_RETAIL_MEMBER_SET.has(c.parentCategorySlug));
    } else if (activeCategory !== "all") {
      result = result.filter((c) => c.parentCategorySlug === activeCategory);
    }

    if (originCountry !== "all") {
      result = result.filter((c) => c.originCountry === originCountry);
    }

    if (targetMarket === "all") {
      result = result.filter((c) => c.visits >= ALL_MARKETS_VISITS_THRESHOLD);
    } else {
      result = result.filter(
        (c) => c.visits * getMarketShare(c, targetMarket) >= MARKET_VISITS_THRESHOLD
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.domain.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.descriptionCn.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      switch (mode) {
        case "market":
          return b.score - a.score;
        case "growing":
          return (
            b.effectiveGrowthScore - a.effectiveGrowthScore ||
            b.growthRate - a.growthRate
          );
        case "visited": {
          const wA = a.visits * getMarketShare(a, targetMarket);
          const wB = b.visits * getMarketShare(b, targetMarket);
          return wB - wA;
        }
        case "engagement": {
          if (targetMarket !== "all") {
            const aPrimary = getPrimaryMarket(a) === targetMarket ? 1 : 0;
            const bPrimary = getPrimaryMarket(b) === targetMarket ? 1 : 0;
            if (aPrimary !== bPrimary) return bPrimary - aPrimary;
          }
          return b.engagementScore - a.engagementScore;
        }
      }
    });

    return result;
  }, [companies, activeCategory, originCountry, targetMarket, mode, search, otherSlugs]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startRank = (page - 1) * PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [activeCategory, originCountry, targetMarket, mode, search]);

  const categoryOptions = useMemo(() => {
    const isOther = (c: CategoryInfo) => c.count < 10 || c.slug === "other";
    const main = categories.filter((c) => !isOther(c) && !NEW_RETAIL_MEMBER_SET.has(c.slug));
    const newRetailCount = categories
      .filter((c) => NEW_RETAIL_MEMBER_SET.has(c.slug))
      .reduce((sum, c) => sum + c.count, 0);
    const othersCount = categories.filter(isOther).reduce((sum, c) => sum + c.count, 0);
    const result: CategoryInfo[] = [];
    if (newRetailCount > 0) {
      result.push({ slug: NEW_RETAIL_SLUG, name: "New Retail", count: newRetailCount });
    }
    result.push(...main);
    if (othersCount > 0) {
      result.push({ slug: "_others", name: "Others", count: othersCount });
    }
    return result;
  }, [categories]);

  const visibleCount = expanded
    ? Math.min(filtered.length, page * PAGE_SIZE)
    : Math.min(filtered.length, TOP_PREVIEW);
  const display = expanded ? paged : filtered.slice(0, TOP_PREVIEW);
  const displayStartRank = expanded ? startRank : 0;
  const showPagination = expanded && totalPages > 1;

  const updatedLabel = companies[0]?.snapshotDate
    ? new Date(companies[0].snapshotDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    : "";

  const modeTabs = (
    <div className="inline-flex bg-card border border-border rounded-xl p-1 gap-1">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => setModePersist(m.id)}
          className={cn(
            "px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
            mode === m.id
              ? "bg-accent text-white shadow-sm"
              : "text-muted hover:text-foreground hover:bg-background/40"
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {/* Row 1: mode tabs (desktop) / mode dropdown (mobile) + Search aligned right */}
      <div className="flex items-center gap-3 mb-3">
        <div className="hidden sm:block">{modeTabs}</div>
        <div className="sm:hidden flex-1 min-w-0">
          <Dropdown
            label="Mode"
            value={mode}
            options={MODES.map((m) => ({
              value: m.id,
              label: m.label,
            }))}
            onChange={(v) => setModePersist(v as RankingMode)}
          />
        </div>
        <div className="ml-auto shrink-0">
          <SearchToggle value={search} onChange={setSearch} />
        </div>
      </div>

      {/* Row 2: Showing line + filter dropdowns */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <p className="text-sm text-muted">
          Showing {visibleCount} of {filtered.length} companies
          {expanded && totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <Dropdown
            label="Category"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            }
            value={activeCategory}
            options={[
              { value: "all", label: "All Categories" },
              ...categoryOptions.map((c) => ({ value: c.slug, label: c.name })),
            ]}
            onChange={setActiveCategory}
          />

          <Dropdown
            label="Origin"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9 9 0 110-18 9 9 0 010 18zm0 0c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9m-9 9h18" />
              </svg>
            }
            value={originCountry}
            options={[
              { value: "all", label: "All Origins" },
              ...originOptions.map((c) => ({ value: c.code, label: c.name || c.code })),
            ]}
            onChange={setOriginCountry}
          />

          <MarketDropdown
            value={targetMarket}
            options={targetOptions}
            onChange={setTargetMarket}
          />
        </div>
      </div>

      {/* Ranking table */}
      <div className="bg-card border border-border rounded-xl">
        {/* Table header (sticky) */}
        <div
          className={cn(
            "hidden sm:grid sticky top-12 z-20 gap-4 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted border-b border-border rounded-t-xl bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75",
            mode === "engagement"
              ? "grid-cols-[4rem_minmax(0,1fr)_7rem_6rem]"
              : "grid-cols-[4rem_minmax(0,1fr)_7rem_7rem_6rem]"
          )}
        >
          <span>#</span>
          <span>Brand</span>
          {mode === "engagement" ? (
            <span className="flex items-center justify-end gap-1.5">
              Engagement
              <span className="relative group/info inline-flex">
                <span className="inline-flex w-4 h-4 items-center justify-center rounded-full border border-muted/50 text-[10px] leading-none text-muted hover:text-foreground hover:border-foreground/60 cursor-help">
                  ?
                </span>
                <span className="hidden group-hover/info:block absolute right-0 top-full mt-2 w-72 p-3 rounded-lg bg-card border border-border shadow-lg text-xs font-normal normal-case tracking-normal text-foreground leading-relaxed z-30">
                  Calculated from bounce rate, average session duration, and pages per visit.
                </span>
              </span>
            </span>
          ) : (
            <>
              <span
                className="text-right cursor-help"
                title="Total website visits in the most recent month (SimilarWeb)"
              >
                Visits
              </span>
              <span
                className="text-right cursor-help"
                title="3-month traffic growth rate compared to 3 months ago"
              >
                Growth
              </span>
            </>
          )}
          <span
            className="text-right cursor-help"
            title="GBI Score (0-95): composite rating across traffic scale, growth, visit depth, bounce quality and session time"
          >
            Score
          </span>
        </div>
        <div className="grid sm:hidden sticky top-12 z-20 grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] gap-4 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted border-b border-border rounded-t-xl bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
          <span>#</span>
          <span>Brand</span>
          <span className="text-right">Score</span>
        </div>

        {display.map((company, i) => (
          <CompanyCard
            key={company.domain}
            company={company}
            rank={displayStartRank + i + 1}
            index={i}
            eager={i < 10}
            metric={mode === "engagement" ? "engagement" : "visits"}
          />
        ))}
        {display.length === 0 && (
          <div className="text-center py-20 text-muted">
            <p className="text-xl">No companies found</p>
            <p className="text-base mt-1.5">Try adjusting your filters or search term</p>
          </div>
        )}
      </div>

      {/* Updated timestamp */}
      {updatedLabel && (
        <p className="text-xs text-muted mt-2 text-right">
          Updated {updatedLabel}
        </p>
      )}

      {/* Expand / collapse toggle */}
      {filtered.length > TOP_PREVIEW && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => {
              setExpanded((v) => !v);
              if (expanded) {
                setPage(1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-card border border-border hover:border-accent/40 hover:text-accent transition-colors"
          >
            {expanded ? (
              <>
                Show top 10 only
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                Show all {filtered.length} companies
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={page <= 1}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-base font-medium transition-colors",
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
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1 text-muted text-base">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={cn(
                      "w-9 h-9 rounded-lg text-base font-medium transition-colors",
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
              "flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-base font-medium transition-colors",
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
