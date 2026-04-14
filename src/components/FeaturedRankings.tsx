"use client";

import Link from "next/link";
import type { Company } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { useMemo } from "react";
import { LogoImage } from "./LogoImage";

const FEATURED_CATEGORIES = [
  { slug: "computers_electronics_and_technology", label: "Electronics & Tech", icon: "💻" },
  { slug: "lifestyle", label: "Lifestyle & Fashion", icon: "👗" },
  { slug: "games", label: "Gaming", icon: "🎮" },
  { slug: "e-commerce_and_shopping", label: "E-Commerce", icon: "🛒" },
];

export function FeaturedRankings({ companies }: { companies: Company[] }) {
  const featured = useMemo(() => {
    const usCompanies = companies.filter(
      (c) => c.topCountryShares[0]?.countryCode === "US"
    );

    return FEATURED_CATEGORIES.map((cat) => {
      const filtered = usCompanies
        .filter((c) => c.parentCategorySlug === cat.slug)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      return { ...cat, companies: filtered };
    });
  }, [companies]);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <img
          src="https://flagcdn.com/w40/us.png"
          alt="United States"
          className="w-5 h-3.5 object-cover rounded-[2px] border border-border/50"
        />
        <h2 className="text-sm font-semibold text-foreground">Top Brands in the U.S. Market</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {featured.map((cat) => (
        <div
          key={cat.slug}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-sm">{cat.icon}</span>
            <h3 className="text-xs font-semibold text-foreground truncate">
              {cat.label}
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {cat.companies.map((company, i) => (
              <Link
                key={company.domain}
                href={`/company/${company.domain}`}
                className="flex items-center gap-2 group"
              >
                <span className="text-[11px] font-mono text-muted w-4 shrink-0">
                  {i + 1}
                </span>
                <div className="w-6 h-6 rounded overflow-hidden bg-white dark:bg-gray-800 border border-border/50 flex items-center justify-center shrink-0">
                  {(company.logoUrl || company.screenshotUrl) ? (
                    <LogoImage
                      src={company.logoUrl || company.screenshotUrl}
                      alt={company.domain}
                      eager
                    />
                  ) : (
                    <span className="text-[9px] text-muted font-bold">
                      {company.domain.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate group-hover:text-accent transition-colors">
                    {company.domain}
                  </p>
                </div>
                <span className="text-[10px] text-muted shrink-0">
                  {formatNumber(company.visits)}
                </span>
              </Link>
            ))}
            {cat.companies.length === 0 && (
              <p className="text-[11px] text-muted">No data yet</p>
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
