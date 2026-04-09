import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllCompanies, getCompanyByDomain } from "@/lib/data";
import {
  formatNumber,
  formatPercent,
  formatGrowth,
  formatDuration,
  cn,
} from "@/lib/utils";
import { ScoreBadge } from "@/components/ScoreBadge";

export async function generateStaticParams() {
  const companies = await getAllCompanies();
  return companies.map((c) => ({ domain: c.domain }));
}

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
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function BarSegment({
  label,
  value,
  maxValue,
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 text-xs text-muted shrink-0 text-right">{label}</span>
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-5 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.max(width, 1)}%` }}
        />
      </div>
      <span className="w-14 text-xs font-medium text-right">
        {formatPercent(value)}
      </span>
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

  const maxTraffic = Math.max(...company.trafficSources.map((s) => s.share));
  const maxCountry = Math.max(...company.topCountryShares.map((s) => s.value));
  const visitValues = company.monthlyVisits.map((m) => m.visits);
  const maxVisit = Math.max(...visitValues);

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
            <div className="w-full h-full flex items-center justify-center text-muted text-2xl font-bold">
              {company.domain.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{company.domain}</h1>
              <p className="text-muted text-sm mt-1">
                {company.title !== company.domain ? company.title : ""}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-accent-light text-accent font-medium">
                  {company.parentCategoryName}
                </span>
                {company.categoryName !== company.parentCategoryName && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-muted font-medium">
                    {company.categoryName}
                  </span>
                )}
              </div>
            </div>
            <ScoreBadge score={company.score} />
          </div>
          <p className="text-sm text-muted mt-3 leading-relaxed line-clamp-3">
            {company.description}
          </p>
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
          label="Bounce Rate"
          value={formatPercent(company.bounceRate)}
          sub={`${company.pagesPerVisit.toFixed(1)} pages/visit`}
        />
        <MetricCard
          label="Avg. Session"
          value={formatDuration(company.timeOnSite)}
          sub={`#${company.countryRank.toLocaleString()} in ${company.countryCode}`}
        />
      </div>

      {/* Monthly visits trend */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-sm mb-4">Monthly Visit Trend</h2>
        <div className="flex items-end gap-3 h-32">
          {company.monthlyVisits.map((m) => {
            const height = maxVisit > 0 ? (m.visits / maxVisit) * 100 : 0;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-muted">
                  {formatNumber(m.visits)}
                </span>
                <div className="w-full flex items-end" style={{ height: "80px" }}>
                  <div
                    className="w-full bg-accent/20 rounded-t-md relative"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  >
                    <div
                      className="absolute inset-0 bg-accent rounded-t-md"
                      style={{ opacity: 0.6 + (height / 100) * 0.4 }}
                    />
                  </div>
                </div>
                <span className="text-[11px] text-muted">
                  {new Date(m.month).toLocaleDateString("en-US", {
                    month: "short",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Traffic sources */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4">Traffic Sources</h2>
          <div className="flex flex-col gap-2.5">
            {company.trafficSources
              .sort((a, b) => b.share - a.share)
              .map((s) => (
                <BarSegment
                  key={s.source}
                  label={s.source}
                  value={s.share}
                  maxValue={maxTraffic}
                  color="bg-accent"
                />
              ))}
          </div>
        </div>

        {/* Country shares */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4">Top Countries</h2>
          <div className="flex flex-col gap-2.5">
            {company.topCountryShares.map((s) => (
              <BarSegment
                key={s.countryCode}
                label={s.countryCode}
                value={s.value}
                maxValue={maxCountry}
                color="bg-blue-500"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Top keywords */}
      {company.topKeywords.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4">Top Keywords</h2>
          <div className="flex flex-wrap gap-2">
            {company.topKeywords.map((kw) => (
              <span
                key={kw.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs border border-border"
              >
                <span className="font-medium">{kw.name}</span>
                <span className="text-muted">
                  {formatNumber(kw.estimatedValue)}
                </span>
                {kw.cpc !== null && (
                  <span className="text-success">${kw.cpc}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
