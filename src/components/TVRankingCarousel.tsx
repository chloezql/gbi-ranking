"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Company } from "@/lib/types";
import {
  countryCodeToFlag,
  countryName,
  formatGrowth,
  formatNumber,
} from "@/lib/utils";
import { LogoImage } from "./LogoImage";

interface TVSlide {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  companies: Company[];
}

const SLIDE_DURATION = 12000;
const MEDAL_COLORS = [
  "from-amber-300 to-amber-500",
  "from-slate-200 to-slate-400",
  "from-orange-400 to-orange-700",
];

function CompanyLogo({ company, large = false }: { company: Company; large?: boolean }) {
  return (
    <div
      className={`${
        large ? "w-[clamp(3.5rem,5vw,5.5rem)] h-[clamp(3.5rem,5vw,5.5rem)]" : "w-[clamp(2.5rem,3.2vw,3.5rem)] h-[clamp(2.5rem,3.2vw,3.5rem)]"
      } rounded-2xl bg-white border border-white/20 shadow-lg overflow-hidden flex items-center justify-center shrink-0`}
    >
      {company.logoUrl || company.screenshotUrl ? (
        <LogoImage
          src={company.logoUrl || company.screenshotUrl}
          alt={company.domain}
          eager
        />
      ) : (
        <span className="text-slate-800 text-xl font-bold">
          {company.domain.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function TopCompanyCard({
  company,
  rank,
}: {
  company: Company;
  rank: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.07] px-[clamp(1rem,1.5vw,1.75rem)] py-[clamp(1rem,1.8vh,1.5rem)] shadow-2xl backdrop-blur-sm">
      <div
        className={`absolute -right-8 -top-10 w-32 h-32 rounded-full bg-gradient-to-br ${MEDAL_COLORS[rank - 1]} opacity-20 blur-2xl`}
      />
      <div className="relative flex items-center gap-[clamp(1rem,1.4vw,1.5rem)]">
        <div
          className={`w-[clamp(3rem,4vw,4.5rem)] h-[clamp(3rem,4vw,4.5rem)] rounded-2xl bg-gradient-to-br ${MEDAL_COLORS[rank - 1]} text-[#111923] flex items-center justify-center text-[clamp(1.3rem,2vw,2.2rem)] font-black shadow-lg shrink-0`}
        >
          {rank}
        </div>
        <CompanyLogo company={company} large />
        <div className="min-w-0 flex-1">
          <p className="text-[clamp(1.25rem,1.7vw,2rem)] font-bold text-white truncate">
            {company.domain}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[clamp(.72rem,.85vw,1rem)] text-white/55">
            <span>{countryCodeToFlag(company.originCountry)}</span>
            <span className="truncate">{countryName(company.originCountry) || "Global"}</span>
            <span>•</span>
            <span className="truncate">{company.categoryName}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[clamp(1.5rem,2.2vw,2.6rem)] leading-none font-black text-[#f47745]">
            {company.score}
          </p>
          <p className="text-[clamp(.6rem,.7vw,.8rem)] uppercase tracking-[0.18em] text-white/45 mt-1">
            GBI Score
          </p>
        </div>
      </div>
    </div>
  );
}

function RankedRow({ company, rank }: { company: Company; rank: number }) {
  const isGrowing = company.growthRate >= 0;
  return (
    <div className="grid grid-cols-[3.5rem_3rem_minmax(0,1fr)_7rem_5rem] xl:grid-cols-[4.5rem_4rem_minmax(0,1fr)_9rem_6rem] items-center gap-[clamp(.65rem,1vw,1.25rem)] rounded-2xl border border-white/[0.08] bg-white/[0.045] px-[clamp(.8rem,1vw,1.2rem)] py-[clamp(.55rem,.8vh,.85rem)]">
      <span className="text-[clamp(1.15rem,1.4vw,1.65rem)] font-black text-white/35 tabular-nums">
        #{rank}
      </span>
      <CompanyLogo company={company} />
      <div className="min-w-0">
        <p className="text-[clamp(1rem,1.2vw,1.4rem)] font-bold text-white truncate">
          {company.domain}
        </p>
        <p className="text-[clamp(.62rem,.75vw,.86rem)] text-white/45 truncate mt-0.5">
          {countryCodeToFlag(company.originCountry)}{" "}
          {company.categoryName}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[clamp(.9rem,1vw,1.15rem)] font-semibold text-white">
          {formatNumber(company.visits)}
        </p>
        <p
          className={`text-[clamp(.62rem,.72vw,.82rem)] font-semibold ${
            isGrowing ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {formatGrowth(company.growthRate)}
        </p>
      </div>
      <div className="text-right">
        <span className="inline-flex min-w-12 justify-center rounded-xl bg-[#e06133] px-2.5 py-2 text-[clamp(1rem,1.2vw,1.4rem)] font-black text-white shadow-lg">
          {company.score}
        </span>
      </div>
    </div>
  );
}

export function TVRankingCarousel({
  slides,
  updatedAt,
}: {
  slides: TVSlide[];
  updatedAt: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex((index + slides.length) % slides.length);
      setCycleKey((key) => key + 1);
    },
    [slides.length]
  );

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const timer = window.setTimeout(
      () => goTo(activeIndex + 1),
      SLIDE_DURATION
    );
    return () => window.clearTimeout(timer);
  }, [activeIndex, goTo, paused, slides.length, cycleKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goTo(activeIndex + 1);
      if (event.key === "ArrowLeft") goTo(activeIndex - 1);
      if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, goTo]);

  const activeSlide = slides[activeIndex];
  const topThree = useMemo(
    () => activeSlide?.companies.slice(0, 3) ?? [],
    [activeSlide]
  );
  const remaining = useMemo(
    () => activeSlide?.companies.slice(3, 10) ?? [],
    [activeSlide]
  );

  if (!activeSlide) return null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07101a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(224,97,51,.24),transparent_28%),radial-gradient(circle_at_88%_78%,rgba(37,99,235,.16),transparent_32%),linear-gradient(135deg,#07101a_0%,#0d1824_55%,#08111c_100%)]" />
      <div className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:48px_48px]" />

      <section
        key={activeSlide.id}
        className="relative z-10 min-h-screen flex flex-col px-[clamp(1.5rem,4vw,5rem)] py-[clamp(1.25rem,3vh,2.75rem)] animate-[tvSlideIn_.65s_cubic-bezier(.22,1,.36,1)]"
      >
        <header className="flex items-start justify-between gap-8">
          <div className="flex items-center gap-[clamp(1.2rem,2vw,2.5rem)]">
            <img src="/gbi-white.png" alt="GBI" className="h-[clamp(2.2rem,4vh,4rem)] w-auto" />
            <div className="h-[clamp(2.2rem,4vh,4rem)] w-px bg-white/20" />
            <div>
              <p className="text-[clamp(.65rem,.8vw,.95rem)] font-semibold tracking-[0.28em] text-[#f47745]">
                {activeSlide.eyebrow}
              </p>
              <h1 className="text-[clamp(2rem,3.4vw,4rem)] leading-[1.05] font-black tracking-[-0.035em] mt-1">
                {activeSlide.title}
              </h1>
            </div>
          </div>
          <div className="text-right pt-1">
            <p className="text-[clamp(.65rem,.75vw,.9rem)] uppercase tracking-[0.2em] text-white/40">
              Data updated
            </p>
            <p className="text-[clamp(.9rem,1vw,1.2rem)] font-semibold text-white/85 mt-1">
              {updatedAt}
            </p>
          </div>
        </header>

        <div className="flex items-center justify-between gap-8 mt-[clamp(.7rem,1.6vh,1.5rem)] mb-[clamp(.8rem,1.8vh,1.8rem)]">
          <p className="max-w-4xl text-[clamp(.85rem,1.05vw,1.25rem)] text-white/55">
            {activeSlide.description}
          </p>
          <div className="flex items-center gap-2 text-[clamp(.65rem,.75vw,.85rem)] text-white/35 shrink-0">
            <span>Ranked by GBI Score</span>
            <span>•</span>
            <span>Top 10</span>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-[minmax(0,.95fr)_minmax(0,1.35fr)] gap-[clamp(1rem,2vw,2.5rem)]">
          <div className="flex flex-col gap-[clamp(.7rem,1.3vh,1.2rem)]">
            {topThree.map((company, index) => (
              <TopCompanyCard
                key={company.domain}
                company={company}
                rank={index + 1}
              />
            ))}
          </div>
          <div className="flex flex-col justify-between gap-[clamp(.35rem,.7vh,.7rem)]">
            {remaining.map((company, index) => (
              <RankedRow
                key={company.domain}
                company={company}
                rank={index + 4}
              />
            ))}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-6 mt-[clamp(.8rem,1.5vh,1.4rem)]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              className="w-9 h-9 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
              aria-label="Previous ranking"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              className="min-w-20 h-9 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors px-3 text-xs font-semibold"
            >
              {paused ? "Play" : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              className="w-9 h-9 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
              aria-label="Next ranking"
            >
              →
            </button>
          </div>

          <div className="flex-1 max-w-2xl">
            <div className="flex items-center gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Show ${slide.title}`}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    index === activeIndex
                      ? "w-12 bg-[#e06133]"
                      : "w-5 bg-white/20 hover:bg-white/35"
                  }`}
                />
              ))}
            </div>
            <div className="h-0.5 bg-white/10 rounded-full mt-2 overflow-hidden">
              {!paused && (
                <div
                  key={`${activeIndex}-${cycleKey}`}
                  className="h-full bg-[#e06133] origin-left animate-[tvProgress_12s_linear_forwards]"
                />
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="text-[clamp(.65rem,.75vw,.85rem)] text-white/35">
              Discover the full index
            </p>
            <p className="text-[clamp(.85rem,1vw,1.15rem)] font-semibold tracking-wide">
              GBI Ranking · gbiworld.org
            </p>
          </div>
        </footer>
      </section>

      <style jsx global>{`
        @keyframes tvProgress {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }
        @keyframes tvSlideIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
