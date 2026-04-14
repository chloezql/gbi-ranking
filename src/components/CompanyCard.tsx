import Link from "next/link";
import type { Company, SortKey } from "@/lib/types";
import { formatNumber, formatGrowth, cn, countryName } from "@/lib/utils";
import { LogoImage } from "./LogoImage";

function MetricBadge({ company, sortKey }: { company: Company; sortKey: SortKey }) {
  let value: string;
  let label: string;
  let colorClass: string;
  let tooltip: string;

  switch (sortKey) {
    case "visits":
      value = formatNumber(company.visits);
      label = "visits";
      tooltip = "Monthly website visits";
      colorClass = "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      break;
    case "growthRate":
      value = formatGrowth(company.growthRate);
      label = "growth";
      tooltip = "3-month traffic growth rate";
      colorClass = company.growthRate >= 0
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400";
      break;
    default:
      value = String(company.score);
      label = "pts";
      tooltip = "GBI Score: traffic, growth, engagement & bounce rate";
      colorClass = company.score >= 75
        ? "bg-accent text-white"
        : company.score >= 50
          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      break;
  }

  return (
    <div title={tooltip} className={cn("flex flex-col items-center justify-center min-w-14 px-3 h-14 rounded-xl text-center shrink-0 cursor-default", colorClass)}>
      <span className="text-base font-bold leading-none whitespace-nowrap">{value}</span>
      <span className="text-[10px] opacity-70 mt-0.5">{label}</span>
    </div>
  );
}

export function CompanyCard({
  company,
  rank,
  sortKey,
  eager = false,
}: {
  company: Company;
  rank: number;
  sortKey: SortKey;
  eager?: boolean;
}) {
  const isGrowing = company.growthRate >= 0;

  return (
    <Link
      href={`/company/${company.domain}`}
      className="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 bg-card rounded-xl border border-border hover:border-accent/30 hover:shadow-md transition-all duration-200"
    >
      <span className="text-sm font-mono text-muted w-5 sm:w-6 text-right shrink-0">
        {rank}
      </span>

      <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shrink-0 border border-border flex items-center justify-center p-1">
        {(company.logoUrl || company.screenshotUrl) ? (
          <LogoImage
            src={company.logoUrl || company.screenshotUrl}
            alt={company.domain}
            eager={eager}
          />
        ) : (
          <span className="text-muted text-xs font-bold">
            {company.domain.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-sm group-hover:text-accent transition-colors truncate">
            {company.domain}
          </h3>
          {company.originCountry && (
            <img
              src={`https://flagcdn.com/w40/${company.originCountry.toLowerCase()}.png`}
              alt={countryName(company.originCountry)}
              title={countryName(company.originCountry)}
              className="shrink-0 w-5 h-3.5 object-cover rounded-[2px] border border-border/50 cursor-default"
              loading="lazy"
            />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-light text-accent font-medium truncate max-w-[120px] sm:max-w-none">
            {company.categoryName}
          </span>
        </div>
        <p className="text-xs text-muted mt-1 truncate max-w-xl hidden sm:block">
          {company.description || company.title}
        </p>
        <div className="flex items-center gap-3 sm:gap-4 mt-1.5 text-xs text-muted">
          <span
            title="Total website visits in the most recent month"
            className="cursor-default"
          >
            <span className="text-foreground font-medium">{formatNumber(company.visits)}</span>
            {" "}visits/mo
          </span>
          <span
            title="3-month traffic growth rate compared to 3 months ago"
            className={cn(
              "font-medium cursor-default",
              isGrowing ? "text-success" : "text-danger"
            )}
          >
            {formatGrowth(company.growthRate)} growth
          </span>
          <span
            title="GBI Score: composite rating based on traffic, growth, engagement & bounce rate (0–95)"
            className="hidden sm:inline text-foreground font-medium cursor-default"
          >
            {company.score} pts
          </span>
        </div>
      </div>

      <MetricBadge company={company} sortKey={sortKey} />
    </Link>
  );
}
