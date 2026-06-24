import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllCompanies, getCompanyByDomain } from "@/lib/data";
import {
  formatNumber,
  formatPercent,
  formatGrowth,
  formatDuration,
  countryName,
} from "@/lib/utils";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ClaimButton } from "@/components/ClaimButton";
import { CompanyDescription } from "@/components/CompanyDescription";
import { VisitTrendChart } from "@/components/VisitTrendChart";
import { TrafficSourceDonut } from "@/components/TrafficSourceDonut";

export const dynamic = "force-dynamic";

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-[22px] font-bold">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const company = await getCompanyByDomain(decodeURIComponent(domain));
  if (!company) notFound();

  const maxKeywordValue = Math.max(...company.topKeywords.map((keyword) => keyword.estimatedValue));
  const topCountries = [...company.topCountryShares]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const updatedLabel = company.snapshotDate
    ? new Date(company.snapshotDate).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;
  const scoreParts = [
    {
      label: "Traffic scale",
      score: company.scoreBreakdown.traffic,
      weight: "60% weight",
      metric: formatNumber(company.visits),
      color: "#E06133",
    },
    {
      label: "Traffic growth",
      score: company.scoreBreakdown.growth,
      weight: "15% weight",
      metric: formatGrowth(company.growthRate),
      color: "#F59E0B",
    },
    {
      label: "Visit depth",
      score: company.scoreBreakdown.visitDepth,
      weight: "10% weight",
      metric: `${company.pagesPerVisit.toFixed(1)} pages`,
      color: "#2563EB",
    },
    {
      label: "Bounce quality",
      score: company.scoreBreakdown.bounceQuality,
      weight: "7.5% weight",
      metric: formatPercent(company.bounceRate),
      color: "#14B8A6",
    },
    {
      label: "Session time",
      score: company.scoreBreakdown.sessionTime,
      weight: "7.5% weight",
      metric: formatDuration(company.timeOnSite),
      color: "#8B5CF6",
    },
  ];
  let scoreOffset = 0;
  const scoreGradient = scoreParts
    .map((part) => {
      const start = company.score > 0 ? (scoreOffset / company.score) * 100 : 0;
      scoreOffset += part.score;
      const end = company.score > 0 ? (scoreOffset / company.score) * 100 : 0;
      return `${part.color} ${start}% ${end}%`;
    })
    .join(", ");
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted mb-6">
        <Link href="/" className="hover:text-accent transition-colors">
          Rankings
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{company.domain}</span>
      </nav>

      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="w-full sm:w-48 h-32 sm:h-36 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-border shrink-0">
          {company.screenshotUrl ? (
            <img
              src={company.screenshotUrl}
              alt={company.domain}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-[26px] font-bold">
              {company.domain.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[26px] font-bold">{company.domain}</h1>
                {company.originCountry && (
                  <img
                    src={`https://flagcdn.com/w40/${company.originCountry.toLowerCase()}.png`}
                    alt={countryName(company.originCountry)}
                    title={countryName(company.originCountry)}
                    className="w-6 h-4 object-cover rounded-[2px] border border-border/50"
                  />
                )}
              </div>
              <p className="text-muted text-sm mt-1">
                {company.title !== company.domain ? company.title : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-accent-light text-accent font-medium">
                  {company.parentCategoryName}
                </span>
                {company.categoryName !== company.parentCategoryName && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-muted font-medium">
                    {company.categoryName}
                  </span>
                )}
                {updatedLabel && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                    </svg>
                    Data updated {updatedLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="relative group/score shrink-0 z-40">
              <ScoreBadge score={company.score} />
              <div className="absolute top-full right-0 pt-2 w-[min(48rem,calc(100vw-2rem))] opacity-0 invisible translate-y-1 pointer-events-none transition-all duration-200 ease-out group-hover/score:opacity-100 group-hover/score:visible group-hover/score:translate-y-0 group-hover/score:pointer-events-auto">
                <div className="bg-card border border-border rounded-xl shadow-2xl p-5">
                  <div className="mb-3">
                    <p className="text-base font-semibold">How the GBI score is built</p>
                    <p className="text-[11px] text-muted mt-0.5">
                      Five normalized signals, weighted against all companies in the index
                    </p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_12rem] items-center gap-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-0.5">
                      {scoreParts.map((part) => (
                        <div
                          key={part.label}
                          className="flex items-center gap-3 py-2 border-b border-border/70"
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: part.color }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{part.label}</span>
                              <span className="text-[9px] text-muted">{part.weight}</span>
                            </div>
                            <p className="text-[10px] text-muted mt-0.5">
                              Current metric: {part.metric}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xl font-bold">{part.score}</span>
                            <span className="text-[9px] text-muted ml-1">pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="relative w-40 h-40">
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{ background: `conic-gradient(${scoreGradient})` }}
                        />
                        <div className="absolute inset-7 rounded-full bg-card border border-border flex flex-col items-center justify-center text-center">
                          <span className="text-[38px] font-bold">{company.score}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted mt-0.5">
                            GBI score
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted mt-3">
                    Contribution points are allocated from normalized weighted signals after final
                    score scaling and any low-traffic cap. The five values add up to the displayed score.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <CompanyDescription
            description={company.description}
            descriptionCn={company.descriptionCn}
            className="text-sm text-muted mt-3 leading-relaxed line-clamp-3"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={`https://${company.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Visit Website
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <ClaimButton domain={company.domain} />
          </div>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <MetricCard
          label="Monthly Visits"
          value={formatNumber(company.visits)}
          sub={`Global rank #${company.globalRank.toLocaleString()}`}
        />
        <MetricCard
          label="3-Month Growth"
          value={formatGrowth(company.growthRate)}
          sub={company.growthRate >= 0 ? "Trending up" : "Trending down"}
        />
        <MetricCard
          label="Category Rank"
          value={company.categoryRank > 0 ? `#${company.categoryRank.toLocaleString()}` : "N/A"}
          sub={company.categoryName}
        />
        <MetricCard
          label="Engagement"
          value={formatPercent(company.bounceRate)}
          sub={`${company.pagesPerVisit.toFixed(1)} pages · ${formatDuration(company.timeOnSite)}`}
        />
      </div>

      {/* Monthly visits trend */}
      <div className="bg-card border border-border rounded-xl px-5 py-3.5 mb-6">
        <VisitTrendChart data={company.monthlyVisits} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Traffic sources */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-base mb-4">Traffic Sources</h2>
          <TrafficSourceDonut sources={company.trafficSources} monthlyVisits={company.visits} />
        </div>

        {/* Country shares */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-base">Top Countries</h2>
            <p className="text-[11px] text-muted mt-0.5">Largest markets by share of website traffic</p>
          </div>
          <div className="flex flex-col gap-3">
            {topCountries.map((country, index) => (
              <div
                key={country.countryCode}
                className="relative overflow-hidden rounded-xl border border-border bg-background/50 p-3.5"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-blue-500/10"
                  style={{ width: `${Math.max(country.value * 100, 2)}%` }}
                />
                <div className="relative flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-blue-500 text-white flex items-center justify-center text-base font-bold shrink-0">
                    #{index + 1}
                  </span>
                  <img
                    src={`https://flagcdn.com/w40/${country.countryCode.toLowerCase()}.png`}
                    alt={countryName(country.countryCode)}
                    className="w-7 h-5 object-cover rounded-[3px] border border-border/50 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold truncate">
                      {countryName(country.countryCode)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {formatNumber(Math.round(company.visits * country.value))} estimated visits
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold">{formatPercent(country.value)}</p>
                    <p className="text-[10px] text-muted">traffic share</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top keywords */}
      {company.topKeywords.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
            <div>
              <h2 className="font-semibold text-base">Top Keywords</h2>
              <p className="text-[11px] text-muted mt-0.5">Estimated search traffic and cost per click</p>
            </div>
          </div>

          {/* Mobile: text list only */}
          <div className="sm:hidden flex flex-wrap gap-2">
            {[...company.topKeywords]
              .sort((a, b) => b.estimatedValue - a.estimatedValue)
              .map((keyword) => (
                <span
                  key={keyword.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-light text-accent text-sm font-medium"
                  title={`${formatNumber(keyword.estimatedValue)} · CPC ${keyword.cpc !== null ? `$${keyword.cpc.toFixed(2)}` : "—"}`}
                >
                  {keyword.name}
                </span>
              ))}
          </div>

          {/* Desktop: bar chart */}
          <div className="hidden sm:block overflow-x-auto pb-1">
            <div
              className="grid items-end gap-4 min-w-[44rem] h-64"
              style={{
                gridTemplateColumns: `repeat(${company.topKeywords.length}, minmax(6rem, 1fr))`,
              }}
            >
              {[...company.topKeywords]
                .sort((a, b) => b.estimatedValue - a.estimatedValue)
                .map((keyword) => {
                  const height =
                    maxKeywordValue > 0 ? (keyword.estimatedValue / maxKeywordValue) * 100 : 0;
                  return (
                    <div key={keyword.name} className="h-full flex flex-col items-center justify-end min-w-0">
                      <span className="text-[13px] font-semibold mb-1">
                        {formatNumber(keyword.estimatedValue)}
                      </span>
                      <div className="w-full h-40 flex items-end justify-center border-b border-border">
                        <div
                          className="w-4/5 max-w-24 bg-accent rounded-t-md transition-[height]"
                          style={{ height: `${Math.max(height, 3)}%` }}
                          title={`${keyword.name}: ${formatNumber(keyword.estimatedValue)}`}
                        />
                      </div>
                      <span
                        className="text-[11px] font-medium text-center leading-tight mt-2 line-clamp-2 min-h-7"
                        title={keyword.name}
                      >
                        {keyword.name}
                      </span>
                      <span className="text-[10px] text-muted">
                        CPC {keyword.cpc !== null ? `$${keyword.cpc.toFixed(2)}` : "—"}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Data source */}
      <p className="text-[11px] text-muted mt-8 text-center">
        Traffic data sourced from{" "}
        <a
          href="https://www.similarweb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground transition-colors"
        >
          SimilarWeb
        </a>
        . Scores are calculated by GBI.
      </p>
    </div>
  );
}
