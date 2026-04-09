import Link from "next/link";
import type { Company, SortKey } from "@/lib/types";
import { formatNumber, formatGrowth, cn } from "@/lib/utils";

function MetricBadge({ company, sortKey }: { company: Company; sortKey: SortKey }) {
  let value: string;
  let label: string;
  let colorClass: string;

  switch (sortKey) {
    case "visits":
      value = formatNumber(company.visits);
      label = "visits";
      colorClass = "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      break;
    case "growthRate":
      value = formatGrowth(company.growthRate);
      label = "growth";
      colorClass = company.growthRate >= 0
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400";
      break;
    default:
      value = String(company.score);
      label = "pts";
      colorClass = company.score >= 75
        ? "bg-accent text-white"
        : company.score >= 50
          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      break;
  }

  return (
    <div className={cn("flex flex-col items-center justify-center min-w-14 px-3 h-14 rounded-xl text-center shrink-0", colorClass)}>
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

      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 border border-border">
        {company.screenshotUrl ? (
          <img
            src={company.screenshotUrl}
            alt={company.domain}
            className="w-full h-full object-cover animate-[fadeIn_0.3s_ease-in]"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs font-bold">
            {company.domain.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm group-hover:text-accent transition-colors truncate">
          {company.domain}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-light text-accent font-medium truncate max-w-[120px] sm:max-w-none">
            {company.categoryName}
          </span>
        </div>
        <p className="text-xs text-muted mt-1 truncate max-w-xl hidden sm:block">
          {company.description || company.title}
        </p>
        <div className="flex items-center gap-3 sm:gap-4 mt-1.5 text-xs text-muted">
          <span title="Monthly visits">
            <span className="text-foreground font-medium">{formatNumber(company.visits)}</span>
            {" "}visits
          </span>
          <span
            title="3-month growth"
            className={cn(
              "font-medium",
              isGrowing ? "text-success" : "text-danger"
            )}
          >
            {formatGrowth(company.growthRate)}
          </span>
          <span className="hidden sm:inline text-foreground font-medium">
            {company.score} pts
          </span>
        </div>
      </div>

      <MetricBadge company={company} sortKey={sortKey} />
    </Link>
  );
}
