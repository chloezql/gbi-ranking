"use client";

import { useState } from "react";
import { formatGrowth, formatNumber } from "@/lib/utils";

interface VisitPoint {
  month: string;
  visits: number;
}

const WIDTH = 720;
const HEIGHT = 154;
const PADDING = { top: 16, right: 18, bottom: 27, left: 18 };

export function VisitTrendChart({ data }: { data: VisitPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"growth" | "visits">("growth");
  const sorted = [...data]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  if (sorted.length === 0) {
    return <p className="py-12 text-center text-sm text-muted">No trend data available.</p>;
  }

  const values = sorted.map((point) => point.visits);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const visitRange = Math.max(maxValue - minValue, maxValue * 0.015, 1);
  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const slotWidth = chartWidth / sorted.length;
  const barWidth = Math.min(slotWidth * 0.32, 58);
  const visitBarWidth = Math.min(slotWidth * 0.72, 118);
  const growthCenter = PADDING.top + chartHeight * 0.62;
  const points = sorted.map((point, index) => {
    const x = PADDING.left + slotWidth * index + slotWidth / 2;
    const previous = index > 0 ? sorted[index - 1] : null;
    const monthGrowth =
      previous && previous.visits > 0 ? (point.visits - previous.visits) / previous.visits : null;
    const visitY =
      PADDING.top +
      ((maxValue - point.visits + visitRange * 0.12) / (visitRange * 1.24)) *
        chartHeight *
        0.5;
    return { ...point, x, monthGrowth, visitY };
  });

  const growthValues = points
    .map((point) => point.monthGrowth)
    .filter((value): value is number => value !== null);
  const growthLimit = Math.max(
    ...growthValues.map((value) => Math.abs(value)),
    0.01
  );
  const visitLinePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.visitY}`)
    .join(" ");
  const overallGrowth =
    sorted.length > 1 && sorted[0].visits > 0
      ? (sorted[sorted.length - 1].visits - sorted[0].visits) / sorted[0].visits
      : 0;
  const activePoint = activeIndex === null ? null : points[activeIndex];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-0">
        <div>
          <h2 className="font-semibold text-base">Traffic & Growth Trend</h2>
          <div className="min-h-3.5 mt-0.5">
            <div
              className={`flex flex-wrap items-center gap-3 text-[10px] text-muted transition-all duration-300 ${
                viewMode === "growth"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-1 pointer-events-none absolute"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-accent rounded-full" />
                Monthly visits · zoomed scale
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="flex items-end gap-0.5 h-2.5">
                  <span className="w-1.5 h-2.5 rounded-sm bg-success" />
                  <span className="w-1.5 h-1.5 rounded-sm bg-danger" />
                </span>
                Month-over-month growth · 0% baseline
              </span>
            </div>
            <div
              className={`flex items-center gap-1.5 text-[10px] text-muted transition-all duration-300 ${
                viewMode === "visits"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-1 pointer-events-none absolute"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-accent/75" />
              Monthly visits with month-over-month direction
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setViewMode("growth")}
              className={`px-2 py-0.5 rounded-md text-xs font-semibold transition-all duration-300 ${
                viewMode === "growth"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Growth view
            </button>
            <button
              type="button"
              onClick={() => setViewMode("visits")}
              className={`px-2 py-0.5 rounded-md text-xs font-semibold transition-all duration-300 ${
                viewMode === "visits"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Visits view
            </button>
          </div>
          {sorted.length > 1 && (
            <div className="text-right">
              <p className="text-[9px] text-muted leading-none">Period change</p>
              <p className={`text-sm font-semibold mt-0.5 ${overallGrowth >= 0 ? "text-success" : "text-danger"}`}>
                {formatGrowth(overallGrowth)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="relative -mx-2 sm:mx-0 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
        {activePoint && (
          <div
            className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full bg-foreground text-background rounded-lg px-3 py-2 shadow-lg"
            style={{
              left: `${(activePoint.x / WIDTH) * 100}%`,
              top: "38%",
            }}
          >
            <p className="text-[10px] opacity-70 whitespace-nowrap">
              {new Date(activePoint.month).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-sm font-semibold whitespace-nowrap">
              {formatNumber(activePoint.visits)} visits
            </p>
            {activePoint.monthGrowth !== null && (
              <p className="text-[10px] opacity-80 whitespace-nowrap">
                {formatGrowth(activePoint.monthGrowth)} vs. prior month
              </p>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto min-w-[720px] sm:min-w-0 overflow-visible"
          role="img"
          aria-label="Monthly website visits and month-over-month growth"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <g
            className={`transition-all duration-500 ease-out ${
              viewMode === "growth"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-1 pointer-events-none"
            }`}
          >
            {[0.2, 0.4].map((ratio) => (
              <line
                key={ratio}
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={PADDING.top + chartHeight * ratio}
                y2={PADDING.top + chartHeight * ratio}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="4 5"
              />
            ))}
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={growthCenter}
              y2={growthCenter}
              stroke="var(--muted)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.75"
            />
            <text
              x={WIDTH - PADDING.right}
              y={growthCenter - 5}
              textAnchor="end"
              fill="var(--muted)"
              fontSize="9"
            >
              0%
            </text>
          </g>
          {points.map((point, index) => {
            const growthHeight =
              point.monthGrowth === null
                ? 0
                : (Math.abs(point.monthGrowth) / growthLimit) * chartHeight * 0.24;
            const growthY =
              point.monthGrowth !== null && point.monthGrowth >= 0
                ? growthCenter - growthHeight
                : growthCenter;
            return (
              <g key={point.month}>
                <rect
                  x={PADDING.left + slotWidth * index}
                  y={PADDING.top}
                  width={slotWidth}
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setActiveIndex(index)}
                />
                <g
                  className={`transition-all duration-500 ease-out ${
                    viewMode === "growth"
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-1 pointer-events-none"
                  }`}
                >
                  {point.monthGrowth === null ? (
                    <text
                      x={point.x}
                      y={growthCenter + 14}
                      textAnchor="middle"
                      fill="var(--muted)"
                      fontSize="11"
                      fontWeight="600"
                    >
                      Baseline
                    </text>
                  ) : (
                    <>
                      <rect
                        x={point.x - barWidth / 2}
                        y={growthY}
                        width={barWidth}
                        height={Math.max(growthHeight, 2)}
                        rx="3"
                        fill={point.monthGrowth >= 0 ? "var(--success)" : "var(--danger)"}
                        opacity={activeIndex === null || activeIndex === index ? 0.82 : 0.48}
                        className="pointer-events-none transition-opacity"
                      />
                      <text
                        x={point.x}
                        y={
                          point.monthGrowth >= 0
                            ? growthY - 5
                            : growthCenter + growthHeight + 12
                        }
                        textAnchor="middle"
                        fill={point.monthGrowth >= 0 ? "var(--success)" : "var(--danger)"}
                        fontSize="12"
                        fontWeight="700"
                        className="pointer-events-none"
                      >
                        {formatGrowth(point.monthGrowth)}
                      </text>
                    </>
                  )}
                </g>
                <g
                  className={`transition-all duration-500 ease-out ${
                    viewMode === "visits"
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-1 pointer-events-none"
                  }`}
                >
                  <rect
                    x={point.x - visitBarWidth / 2}
                    y={HEIGHT - PADDING.bottom - (point.visits / maxValue) * chartHeight * 0.78}
                    width={visitBarWidth}
                    height={(point.visits / maxValue) * chartHeight * 0.78}
                    rx="3"
                    fill="var(--accent)"
                    opacity={activeIndex === null || activeIndex === index ? 0.72 : 0.42}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center bottom",
                      transform:
                        activeIndex === index
                          ? "scale(1.025, 1.035)"
                          : "scale(1)",
                      transition:
                        "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease",
                    }}
                  />
                  {point.monthGrowth !== null && (
                    <g
                      transform={`translate(${point.x + 30}, ${
                        HEIGHT -
                        PADDING.bottom -
                        (point.visits / maxValue) * chartHeight * 0.78 -
                        9
                      })`}
                    >
                      <path
                        d={
                          point.monthGrowth >= 0
                            ? "M -3 2 L 0 -2 L 3 2 M 0 -2 V 5"
                            : "M -3 -2 L 0 2 L 3 -2 M 0 2 V -5"
                        }
                        fill="none"
                        stroke={point.monthGrowth >= 0 ? "var(--success)" : "var(--danger)"}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}
                </g>
                <text
                  x={point.x}
                  y={HEIGHT - 14}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize="12"
                >
                  {new Date(point.month).toLocaleDateString("en-US", { month: "short" })}
                </text>
                <g
                  className={`transition-all duration-500 ${
                    viewMode === "visits" ? "translate-y-0" : "-translate-y-0"
                  }`}
                >
                  <text
                    x={point.x}
                    y={
                      viewMode === "growth"
                        ? Math.max(point.visitY - 10, 13)
                        : Math.max(
                            HEIGHT -
                              PADDING.bottom -
                              (point.visits / maxValue) * chartHeight * 0.78 -
                              8,
                            13
                          )
                    }
                    textAnchor="middle"
                    fill="var(--foreground)"
                    fontSize="13"
                    fontWeight="600"
                    className="pointer-events-none transition-all duration-500"
                  >
                    {formatNumber(point.visits)}
                  </text>
                </g>
              </g>
            );
          })}
          <g
            className={`transition-all duration-500 ease-out ${
              viewMode === "growth"
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-1 pointer-events-none"
            }`}
          >
            <path
              d={visitLinePath}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
            />
            {points.map((point) => (
              <circle
                key={`visit-${point.month}`}
                cx={point.x}
                cy={point.visitY}
                r="5"
                fill="var(--card)"
                stroke="var(--accent)"
                strokeWidth="3"
                className="pointer-events-none"
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
