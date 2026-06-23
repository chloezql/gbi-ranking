import Link from "next/link";
import type { Company } from "@/lib/types";
import { formatNumber, formatGrowth, cn, countryName } from "@/lib/utils";
import { LogoImage } from "./LogoImage";
import { CountUp } from "./CountUp";

const TOP3_THEME: Record<
  1 | 2 | 3,
  { ribbon: string; cardBg: string; border: string; scoreText: string }
> = {
  1: {
    ribbon: "bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600",
    cardBg:
      "bg-gradient-to-r from-amber-50 via-amber-50/40 to-transparent dark:from-amber-500/15 dark:via-amber-500/5 dark:to-transparent",
    border: "border-amber-200/70 dark:border-amber-500/30",
    scoreText: "text-amber-600 dark:text-amber-400",
  },
  2: {
    ribbon: "bg-gradient-to-b from-slate-200 via-slate-300 to-slate-500",
    cardBg:
      "bg-gradient-to-r from-slate-100 via-slate-100/40 to-transparent dark:from-slate-400/15 dark:via-slate-400/5 dark:to-transparent",
    border: "border-slate-200/70 dark:border-slate-400/30",
    scoreText: "text-slate-600 dark:text-slate-300",
  },
  3: {
    ribbon: "bg-gradient-to-b from-orange-300 via-orange-500 to-orange-700",
    cardBg:
      "bg-gradient-to-r from-orange-50 via-orange-50/40 to-transparent dark:from-orange-500/15 dark:via-orange-500/5 dark:to-transparent",
    border: "border-orange-200/70 dark:border-orange-500/30",
    scoreText: "text-orange-600 dark:text-orange-400",
  },
};

function PennantRibbon({
  rank,
  className,
}: {
  rank: 1 | 2 | 3;
  className: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center w-12 h-16 text-2xl font-extrabold text-white shadow-md",
        className
      )}
      style={{
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)",
      }}
    >
      {rank}
    </span>
  );
}

export function CompanyCard({
  company,
  rank,
  index = 0,
  eager = false,
}: {
  company: Company;
  rank: number;
  index?: number;
  eager?: boolean;
}) {
  const isGrowing = company.growthRate >= 0;
  const isTop3 = rank <= 3;
  const theme = isTop3 ? TOP3_THEME[rank as 1 | 2 | 3] : null;

  return (
    <Link
      href={`/company/${company.domain}`}
      style={{ animationDelay: `${index * 30}ms` }}
      className={cn(
        "group grid items-center gap-4 grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem_6rem] transition-all duration-200 last:border-0 animate-[slideUpFade_420ms_ease-out_both]",
        theme
          ? cn(
              "mx-2 my-2 px-4 sm:px-5 py-5 sm:py-6 rounded-xl border shadow-sm hover:shadow-lg hover:-translate-y-0.5",
              theme.cardBg,
              theme.border
            )
          : "px-5 sm:px-6 py-5 border-b border-border last:rounded-b-xl hover:bg-accent-light/40"
      )}
    >
      <span className="flex items-center justify-start">
        {theme ? (
          <PennantRibbon rank={rank as 1 | 2 | 3} className={theme.ribbon} />
        ) : (
          <span className="block text-center text-lg font-mono text-muted w-full">
            {rank}
          </span>
        )}
      </span>

      <div className="flex items-center gap-4 min-w-0">
        <div
          className={cn(
            "rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-border flex items-center justify-center shrink-0 p-1.5 transition-transform duration-200 group-hover:scale-[1.03]",
            isTop3 ? "w-16 h-16" : "w-14 h-14"
          )}
        >
          {company.logoUrl || company.screenshotUrl ? (
            <LogoImage
              src={company.logoUrl || company.screenshotUrl}
              alt={company.domain}
              eager={eager}
            />
          ) : (
            <span className="text-muted text-base font-bold">
              {company.domain.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className={cn(
                "font-semibold truncate group-hover:text-accent transition-colors",
                isTop3 ? "text-xl" : "text-lg"
              )}
            >
              {company.domain}
            </h3>
            {company.originCountry && (
              <img
                src={`https://flagcdn.com/w40/${company.originCountry.toLowerCase()}.png`}
                alt={countryName(company.originCountry)}
                title={countryName(company.originCountry)}
                className="w-5 h-3.5 object-cover rounded-[2px] border border-border/50 shrink-0"
              />
            )}
            <span className="hidden md:inline text-xs px-2 py-0.5 rounded-full bg-accent-light text-accent font-medium truncate max-w-[180px]">
              {company.categoryName}
            </span>
          </div>
          <p className="hidden md:block text-sm text-muted truncate mt-1.5 max-w-2xl leading-relaxed">
            {company.description || company.title}
          </p>
          {/* Mobile collapsed metrics */}
          <div className="flex sm:hidden items-center gap-3 text-sm text-muted mt-1">
            <span className="tabular-nums">{formatNumber(company.visits)}</span>
            <span
              className={cn(
                "tabular-nums font-medium",
                isGrowing ? "text-success" : "text-danger"
              )}
            >
              {formatGrowth(company.growthRate)}
            </span>
          </div>
        </div>
      </div>

      <span className="hidden sm:block text-right text-lg font-medium tabular-nums">
        {formatNumber(company.visits)}
      </span>
      <span
        className={cn(
          "hidden sm:block text-right text-lg font-medium tabular-nums",
          isGrowing ? "text-success" : "text-danger"
        )}
      >
        {formatGrowth(company.growthRate)}
      </span>
      <span
        className={cn(
          "text-right font-bold tabular-nums",
          isTop3
            ? cn("text-3xl", theme?.scoreText ?? "text-accent")
            : "text-2xl text-foreground"
        )}
      >
        {isTop3 ? <CountUp value={company.score} /> : company.score}
      </span>
    </Link>
  );
}
