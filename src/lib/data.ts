import type { Company, CategoryInfo, CompanyClaim } from "./types";
import { computeScores, computeGrowthRate } from "./scoring";
import { humanizeSlug } from "./utils";
import { supabase } from "./supabase";

interface SupabaseRow {
  company_id: string;
  domain: string;
  title: string | null;
  description: string | null;
  description_usable: boolean | null;
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

function isMissingDescriptionUsableColumn(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42703" ||
    candidate.message?.includes("description_usable") === true
  );
}

async function queryCompanyLatest(ids?: string[]) {
  let query = supabase
    .from("company_latest")
    .select("*")
    .or("description_usable.eq.true,description_usable.is.null");

  if (ids?.length) {
    query = query.in("company_id", ids);
  }

  const result = await query;
  if (!result.error || !isMissingDescriptionUsableColumn(result.error)) {
    return result;
  }

  console.warn(
    "Supabase company_latest.description_usable is missing; falling back to unfiltered company query."
  );

  let fallback = supabase.from("company_latest").select("*");
  if (ids?.length) {
    fallback = fallback.in("company_id", ids);
  }
  return fallback;
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
    descriptionUsable: row.description_usable === true,
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
    scoreBreakdown: {
      traffic: 0,
      growth: 0,
      visitDepth: 0,
      bounceQuality: 0,
      sessionTime: 0,
    },
    growthRate,
    effectiveGrowthScore: 0,
  };
}

export async function getAllCompanies(): Promise<Company[]> {
  const { data, error } = await queryCompanyLatest();

  if (error) {
    console.error("Supabase error:", error);
    return [];
  }

  const companies = (data as SupabaseRow[]).map(transformRow);
  return computeScores(companies).sort((a, b) => b.score - a.score);
}

export async function getCompanyByDomain(domain: string): Promise<Company | undefined> {
  const companies = await getAllCompanies();
  const company = companies.find((c) => c.domain === domain);
  if (!company) return undefined;

  const { data: companyRow } = await supabase
    .from("companies")
    .select("id")
    .eq("domain", domain)
    .single();

  if (!companyRow) return company;

  const { data: snapshots, error } = await supabase
    .from("snapshots")
    .select("snapshot_date, visits, monthly_visits")
    .eq("company_id", companyRow.id)
    .order("snapshot_date", { ascending: true });

  if (error || !snapshots?.length) return company;

  const visitsByMonth = new Map<string, number>();
  for (const snapshot of snapshots as {
    snapshot_date: string | null;
    visits: number | null;
    monthly_visits: Record<string, number> | null;
  }[]) {
    for (const [month, visits] of Object.entries(snapshot.monthly_visits || {})) {
      visitsByMonth.set(month, Number(visits) || 0);
    }
    if (snapshot.snapshot_date && snapshot.visits) {
      visitsByMonth.set(snapshot.snapshot_date, Number(snapshot.visits));
    }
  }

  const monthlyVisits = Array.from(visitsByMonth.entries())
    .map(([month, visits]) => ({ month, visits }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  return monthlyVisits.length ? { ...company, monthlyVisits } : company;
}

export async function getCompaniesByIds(ids: string[]): Promise<Company[]> {
  if (ids.length === 0) return [];
  const { data, error } = await queryCompanyLatest(ids);

  if (error || !data) return [];
  const companies = (data as SupabaseRow[]).map(transformRow);
  return computeScores(companies);
}

export async function submitClaim(domain: string): Promise<string> {
  const { data, error } = await supabase.rpc("claim_company", { p_domain: domain });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getClaimStatus(domain: string): Promise<string> {
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("domain", domain)
    .single();

  if (!company) return "unclaimed";

  const { data: claim } = await supabase
    .from("company_claims")
    .select("status")
    .eq("company_id", company.id)
    .single();

  return claim?.status ?? "unclaimed";
}

export async function getUserClaims(): Promise<CompanyClaim[]> {
  const { data } = await supabase
    .from("company_claims")
    .select("id, status, created_at, companies ( domain, title, logo_url )")
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as CompanyClaim[];
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
