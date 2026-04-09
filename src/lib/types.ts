export interface RawCompanyData {
  domain: string;
  snapshotDate: string;
  title: string;
  description: string;
  category: string;
  screenshot: string;
  globalRank: number;
  countryRank: { Country: number; CountryCode: string; Rank: number };
  categoryRank: string;
  estimatedMonthlyVisits: Record<string, number>;
  bounceRate: string;
  pagesPerVisit: string;
  visits: string;
  timeOnSite: string;
  topCountryShares: { Country: number; CountryCode: string; Value: number }[];
  trafficSources: Record<string, number>;
  competitors: string[];
  isDataFromGA: boolean;
  topKeywords: { name: string; esitmatedValue: number; cpc: number | null }[];
  "countryRank.country"?: number;
  "countryRank.countryCode"?: string;
  "countryRank.rank"?: number;
}

export interface Company {
  domain: string;
  title: string;
  description: string;
  screenshotUrl: string;

  categorySlug: string;
  categoryName: string;
  parentCategorySlug: string;
  parentCategoryName: string;

  snapshotDate: string;
  globalRank: number;
  countryCode: string;
  countryRank: number;
  categoryRank: number;

  visits: number;
  bounceRate: number;
  pagesPerVisit: number;
  timeOnSite: number;

  monthlyVisits: { month: string; visits: number }[];
  topCountryShares: { countryCode: string; value: number }[];
  trafficSources: { source: string; share: number }[];
  topKeywords: { name: string; estimatedValue: number; cpc: number | null }[];

  score: number;
  growthRate: number;
}

export type SortKey = "score" | "visits" | "growthRate";

export interface CategoryInfo {
  slug: string;
  name: string;
  count: number;
}
