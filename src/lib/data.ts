import fs from "fs";
import path from "path";
import type { RawCompanyData, Company, CategoryInfo } from "./types";
import { computeScores, computeGrowthRate } from "./scoring";
import { humanizeSlug } from "./utils";

function parseCategory(raw: string): {
  slug: string;
  name: string;
  parentSlug: string;
  parentName: string;
} {
  if (!raw) {
    return { slug: "other", name: "Other", parentSlug: "other", parentName: "Other" };
  }
  const parts = raw.split("/");
  if (parts.length === 1) {
    const name = humanizeSlug(parts[0]);
    return { slug: parts[0], name, parentSlug: parts[0], parentName: name };
  }
  return {
    slug: raw,
    name: humanizeSlug(parts[parts.length - 1]),
    parentSlug: parts[0],
    parentName: humanizeSlug(parts[0]),
  };
}

function transformRawCompany(raw: RawCompanyData): Company {
  const cat = parseCategory(raw.category);
  const monthlyVisits = Object.entries(raw.estimatedMonthlyVisits || {})
    .map(([month, visits]) => ({ month, visits }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const growthRate = computeGrowthRate(monthlyVisits);

  return {
    domain: raw.domain,
    title: raw.title || raw.domain,
    description: raw.description || "",
    screenshotUrl: raw.screenshot || "",
    categorySlug: cat.slug,
    categoryName: cat.name,
    parentCategorySlug: cat.parentSlug,
    parentCategoryName: cat.parentName,
    snapshotDate: raw.snapshotDate,
    globalRank: raw.globalRank || 0,
    countryCode: raw.countryRank?.CountryCode || raw["countryRank.countryCode"] || "US",
    countryRank: raw.countryRank?.Rank || raw["countryRank.rank"] || 0,
    categoryRank: parseInt(raw.categoryRank) || 0,
    visits: parseInt(raw.visits) || 0,
    bounceRate: parseFloat(raw.bounceRate) || 0,
    pagesPerVisit: parseFloat(raw.pagesPerVisit) || 0,
    timeOnSite: parseFloat(raw.timeOnSite) || 0,
    monthlyVisits,
    topCountryShares: (raw.topCountryShares || []).map((s) => ({
      countryCode: s.CountryCode,
      value: s.Value,
    })),
    trafficSources: Object.entries(raw.trafficSources || {}).map(([source, share]) => ({
      source,
      share,
    })),
    topKeywords: (raw.topKeywords || []).map((k) => ({
      name: k.name,
      estimatedValue: k.esitmatedValue,
      cpc: k.cpc,
    })),
    score: 0,
    growthRate,
  };
}

let cachedCompanies: Company[] | null = null;

export function getAllCompanies(): Company[] {
  if (cachedCompanies) return cachedCompanies;

  const filePath = path.join(
    process.cwd(),
    "dataset_similarweb-scraper_2026-04-09_21-35-37-232.json"
  );
  const rawData: RawCompanyData[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const companies = rawData.map(transformRawCompany);
  cachedCompanies = computeScores(companies).sort((a, b) => b.score - a.score);
  return cachedCompanies;
}

export function getCompanyByDomain(domain: string): Company | undefined {
  return getAllCompanies().find((c) => c.domain === domain);
}

export function getCategories(): CategoryInfo[] {
  const companies = getAllCompanies();
  const map = new Map<string, { name: string; count: number }>();

  for (const c of companies) {
    const key = c.parentCategorySlug;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, { name: c.parentCategoryName, count: 1 });
    }
  }

  return Array.from(map.entries())
    .map(([slug, { name, count }]) => ({ slug, name, count }))
    .sort((a, b) => b.count - a.count);
}
