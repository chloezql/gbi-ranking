"use client";

import { useMemo, useState } from "react";
import { formatNumber, formatPercent } from "@/lib/utils";

const COLORS = [
  "#E06133",
  "#F59E0B",
  "#2563EB",
  "#14B8A6",
  "#8B5CF6",
  "#EC4899",
  "#64748B",
  "#84CC16",
  "#06B6D4",
  "#F97316",
];
const RADIUS = 64;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatSource(source: string): string {
  return source
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Organic/g, " Organic")
    .replace(/Paid/g, " Paid")
    .replace(/\s+/g, " ")
    .trim();
}

export function TrafficSourceDonut({
  sources,
  monthlyVisits,
}: {
  sources: { source: string; share: number }[];
  monthlyVisits: number;
}) {
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const segments = useMemo(() => {
    const sorted = [...sources]
      .filter((source) => source.share > 0)
      .sort((a, b) => b.share - a.share);
    const total = sorted.reduce((sum, source) => sum + source.share, 0);
    let offset = 0;
    return sorted.map((source, index) => {
      const normalizedShare = total > 0 ? source.share / total : 0;
      const segment = {
        ...source,
        normalizedShare,
        color: COLORS[index % COLORS.length],
        dash: normalizedShare * CIRCUMFERENCE,
        offset,
      };
      offset += segment.dash;
      return segment;
    });
  }, [sources]);
  const active = segments.find((segment) => segment.source === activeSource) ?? null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] items-center gap-5">
      <div className="relative w-44 h-44 mx-auto">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="22" />
          {segments.map((segment) => (
            <circle
              key={segment.source}
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth={activeSource === null || activeSource === segment.source ? 22 : 16}
              strokeDasharray={`${segment.dash} ${CIRCUMFERENCE - segment.dash}`}
              strokeDashoffset={-segment.offset}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setActiveSource(segment.source)}
              onMouseLeave={() => setActiveSource(null)}
            />
          ))}
        </svg>
        <div className="absolute inset-8 rounded-full bg-card flex flex-col items-center justify-center text-center pointer-events-none">
          {active ? (
            <>
              <span className="text-sm font-semibold max-w-20 leading-tight">
                {formatSource(active.source)}
              </span>
              <span className="text-xl font-bold mt-0.5">{formatPercent(active.share)}</span>
              <span className="text-[9px] text-muted">
                {formatNumber(Math.round(monthlyVisits * active.share))} est. visits
              </span>
            </>
          ) : (
            <>
              <span className="text-xl font-bold">{segments.length}</span>
              <span className="text-[10px] text-muted">traffic channels</span>
              <span className="text-[9px] text-muted mt-1">Hover to inspect</span>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {segments.map((segment, index) => (
          <button
            key={segment.source}
            type="button"
            onMouseEnter={() => setActiveSource(segment.source)}
            onMouseLeave={() => setActiveSource(null)}
            onFocus={() => setActiveSource(segment.source)}
            onBlur={() => setActiveSource(null)}
            className={`${index >= 3 ? "hidden sm:flex" : "flex"} items-center gap-2 min-w-0 text-left rounded-md px-1 py-0.5 transition-colors ${
              activeSource === segment.source ? "bg-gray-100 dark:bg-gray-800" : ""
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-xs text-muted truncate flex-1">
              {formatSource(segment.source)}
            </span>
            <span className="text-sm font-semibold">{formatPercent(segment.share)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
