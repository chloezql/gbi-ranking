import type { Company } from "./types";

function minMaxNormalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function applyTrafficCap(score: number, visits: number): number {
  if (visits < 10_000) return Math.min(score, 55);
  if (visits < 50_000) return Math.min(score, 70);
  if (visits < 100_000) return Math.min(score, 80);
  return score;
}

function getGrowthInputs(company: Company) {
  const sorted = [...company.monthlyVisits].sort((a, b) => a.month.localeCompare(b.month));
  const firstVisits = sorted[0]?.visits ?? company.visits;
  const lastVisits = sorted[sorted.length - 1]?.visits ?? company.visits;

  return {
    firstVisits,
    lastVisits,
    absoluteGrowth: lastVisits - firstVisits,
  };
}

function computeEffectiveGrowthScores(companies: Company[]): number[] {
  const growthInputs = companies.map(getGrowthInputs);
  const cappedGrowthRates = companies.map((c) => clamp(c.growthRate, -0.8, 2));
  const absoluteGrowth = growthInputs.map((g) => Math.log10(Math.max(g.absoluteGrowth, 1)));
  const baseTraffic = growthInputs.map((g) => Math.log10(Math.max(g.firstVisits, 1)));

  const normGrowthRate = minMaxNormalize(cappedGrowthRates);
  const normAbsoluteGrowth = minMaxNormalize(absoluteGrowth);
  const normBaseTraffic = minMaxNormalize(baseTraffic);

  return companies.map((_, i) => {
    const input = growthInputs[i];
    const rawScore =
      normGrowthRate[i] * 0.45 +
      normAbsoluteGrowth[i] * 0.35 +
      normBaseTraffic[i] * 0.2;

    let score = Math.round(rawScore);
    if (input.absoluteGrowth <= 0) score = Math.min(score, 30);
    if (input.firstVisits < 1_000) score = Math.min(score, 40);
    if (input.firstVisits < 10_000) score = Math.min(score, 65);
    if (input.lastVisits < 10_000) score = Math.min(score, 60);

    return score;
  });
}

export function computeScores(companies: Company[]): Company[] {
  if (companies.length === 0) return companies;

  const logVisits = companies.map((c) => Math.log10(Math.max(c.visits, 1)));
  const growthRates = companies.map((c) => clamp(c.growthRate, -0.8, 2));
  const pagesPerVisit = companies.map((c) => clamp(c.pagesPerVisit, 1, 8));
  const bounceRates = companies.map((c) => clamp(c.bounceRate, 0.05, 0.9));
  const timeOnSite = companies.map((c) => clamp(c.timeOnSite, 5, 300));

  const normVisits = minMaxNormalize(logVisits);
  const normGrowth = minMaxNormalize(growthRates);
  const normPages = minMaxNormalize(pagesPerVisit);
  const normBounce = minMaxNormalize(bounceRates).map((v) => 100 - v);
  const normTime = minMaxNormalize(timeOnSite);

  const rawScores = companies.map(
    (_, i) =>
      normVisits[i] * 0.6 +
      normGrowth[i] * 0.15 +
      normPages[i] * 0.1 +
      normBounce[i] * 0.075 +
      normTime[i] * 0.075
  );

  // Rescale so the top score maps to ~95 and bottom to ~20
  const minRaw = Math.min(...rawScores);
  const maxRaw = Math.max(...rawScores);
  const FLOOR = 20;
  const CEIL = 95;
  const effectiveGrowthScores = computeEffectiveGrowthScores(companies);

  return companies.map((company, i) => {
    const score = applyTrafficCap(
      maxRaw === minRaw
        ? 50
        : Math.round(FLOOR + ((rawScores[i] - minRaw) / (maxRaw - minRaw)) * (CEIL - FLOOR)),
      company.visits
    );
    const weightedSignals = [
      normVisits[i] * 0.6,
      normGrowth[i] * 0.15,
      normPages[i] * 0.1,
      normBounce[i] * 0.075,
      normTime[i] * 0.075,
    ];
    const signalTotal = weightedSignals.reduce((sum, value) => sum + value, 0);
    const exactContributions =
      signalTotal > 0
        ? weightedSignals.map((value) => (value / signalTotal) * score)
        : [score * 0.6, score * 0.15, score * 0.1, score * 0.075, score * 0.075];
    const roundedContributions = exactContributions.map((value) => Math.round(value));
    const roundingDifference =
      score - roundedContributions.reduce((sum, value) => sum + value, 0);
    roundedContributions[0] += roundingDifference;

    return {
      ...company,
      score,
      scoreBreakdown: {
        traffic: roundedContributions[0],
        growth: roundedContributions[1],
        visitDepth: roundedContributions[2],
        bounceQuality: roundedContributions[3],
        sessionTime: roundedContributions[4],
      },
      effectiveGrowthScore: effectiveGrowthScores[i],
    };
  });
}

export function computeGrowthRate(monthlyVisits: { month: string; visits: number }[]): number {
  if (monthlyVisits.length < 2) return 0;
  const sorted = [...monthlyVisits].sort((a, b) => a.month.localeCompare(b.month));
  const first = sorted[0].visits;
  const last = sorted[sorted.length - 1].visits;
  if (first === 0) return last > 0 ? 1 : 0;
  return (last - first) / first;
}
