import type { Company } from "./types";

function minMaxNormalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

export function computeScores(companies: Company[]): Company[] {
  if (companies.length === 0) return companies;

  const logVisits = companies.map((c) => Math.log10(Math.max(c.visits, 1)));
  const growthRates = companies.map((c) => c.growthRate);
  const pagesPerVisit = companies.map((c) => c.pagesPerVisit);
  const bounceRates = companies.map((c) => c.bounceRate);
  const timeOnSite = companies.map((c) => c.timeOnSite);

  const normVisits = minMaxNormalize(logVisits);
  const normGrowth = minMaxNormalize(growthRates);
  const normPages = minMaxNormalize(pagesPerVisit);
  const normBounce = minMaxNormalize(bounceRates).map((v) => 100 - v);
  const normTime = minMaxNormalize(timeOnSite);

  const rawScores = companies.map(
    (_, i) =>
      normVisits[i] * 0.4 +
      normGrowth[i] * 0.25 +
      normPages[i] * 0.15 +
      normBounce[i] * 0.1 +
      normTime[i] * 0.1
  );

  // Rescale so the top score maps to ~95 and bottom to ~20
  const minRaw = Math.min(...rawScores);
  const maxRaw = Math.max(...rawScores);
  const FLOOR = 20;
  const CEIL = 95;

  return companies.map((company, i) => ({
    ...company,
    score:
      maxRaw === minRaw
        ? 50
        : Math.round(FLOOR + ((rawScores[i] - minRaw) / (maxRaw - minRaw)) * (CEIL - FLOOR)),
  }));
}

export function computeGrowthRate(monthlyVisits: { month: string; visits: number }[]): number {
  if (monthlyVisits.length < 2) return 0;
  const sorted = [...monthlyVisits].sort((a, b) => a.month.localeCompare(b.month));
  const first = sorted[0].visits;
  const last = sorted[sorted.length - 1].visits;
  if (first === 0) return last > 0 ? 1 : 0;
  return (last - first) / first;
}
