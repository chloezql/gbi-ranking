import type { Company, CategoryInfo } from "./types";
import { computeScores, computeGrowthRate } from "./scoring";
import { humanizeSlug } from "./utils";
import { supabase } from "./supabase";

interface SupabaseRow {
  company_id: string;
  domain: string;
  title: string | null;
  description: string | null;
  screenshot_url: string | null;
  logo_url: string | null;
  country_code: string | null;
  category_slug: string | null;
  category_name: string | null;
  parent_category_slug: string | null;
  parent_category_name: string | null;
  snapshot_date: string | null;
  global_rank: number | null;
  traffic_country_code: string | null;
  country_rank: number | null;
  category_rank: number | null;
  visits: number | null;
  bounce_rate: number | null;
  pages_per_visit: number | null;
  time_on_site: number | null;
  monthly_visits: Record<string, number> | null;
  top_country_shares: { Country: number; CountryCode: string; Value: number }[] | null;
  traffic_sources: Record<string, number> | null;
  top_keywords: { name: string; esitmatedValue: number; cpc: number | null }[] | null;
}

function transformRow(row: SupabaseRow): Company {
  const monthlyVisits = Object.entries(row.monthly_visits || {})
    .map(([month, visits]) => ({ month, visits }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const growthRate = computeGrowthRate(monthlyVisits);

  return {
    domain: row.domain,
    title: row.title || row.domain,
    description: row.description || "",
    screenshotUrl: row.screenshot_url || "",
    logoUrl: row.logo_url || "",
    originCountry: row.country_code || "",
    categorySlug: row.category_slug || "other",
    categoryName: row.category_name || humanizeSlug(row.category_slug || "other"),
    parentCategorySlug: row.parent_category_slug || row.category_slug || "other",
    parentCategoryName: row.parent_category_name || row.category_name || "Other",
    snapshotDate: row.snapshot_date || "",
    globalRank: row.global_rank || 0,
    countryCode: row.traffic_country_code || "US",
    countryRank: row.country_rank || 0,
    categoryRank: row.category_rank || 0,
    visits: Number(row.visits) || 0,
    bounceRate: Number(row.bounce_rate) || 0,
    pagesPerVisit: Number(row.pages_per_visit) || 0,
    timeOnSite: Number(row.time_on_site) || 0,
    monthlyVisits,
    topCountryShares: (row.top_country_shares || []).map((s) => ({
      countryCode: s.CountryCode,
      value: s.Value,
    })),
    trafficSources: Object.entries(row.traffic_sources || {}).map(([source, share]) => ({
      source,
      share,
    })),
    topKeywords: (row.top_keywords || []).map((k) => ({
      name: k.name,
      estimatedValue: k.esitmatedValue,
      cpc: k.cpc,
    })),
    score: 0,
    growthRate,
  };
}

export async function getAllCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("company_latest")
    .select("*");

  if (error) {
    console.error("Supabase error:", error);
    return [];
  }

  const companies = (data as SupabaseRow[]).map(transformRow);
  return computeScores(companies).sort((a, b) => b.score - a.score);
}

export async function getCompanyByDomain(domain: string): Promise<Company | undefined> {
  const companies = await getAllCompanies();
  return companies.find((c) => c.domain === domain);
}

export async function getCategories(): Promise<CategoryInfo[]> {
  const companies = await getAllCompanies();
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
