import { getAllCompanies, deriveCategories } from "@/lib/data";
import { RankingList } from "@/components/RankingList";
import { IndustryRankings } from "@/components/IndustryRankings";

export const revalidate = 3600;

export default async function HomePage() {
  const companies = await getAllCompanies();
  const categories = deriveCategories(companies);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <a
        href="https://gbiworld.org/consultation"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block overflow-hidden rounded-2xl border border-border shadow-sm hover:shadow-lg transition-shadow mb-8"
      >
        <img
          src="/banner.png"
          alt="Global Brand Innovation Forum"
          className="w-full h-[160px] sm:h-[220px] lg:h-[280px] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent pointer-events-none" />
        <span className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-full shadow-lg group-hover:brightness-110 transition-all">
          免费领取出海竞争力报告
          <svg
            className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </span>
      </a>

      <IndustryRankings />

      <div id="rankings" className="mb-6 scroll-mt-16">
        <div className="flex items-center gap-3">
          <img
            src="/gbi-dark.png"
            alt=""
            aria-hidden
            className="h-9 sm:h-10 w-auto dark:hidden"
          />
          <img
            src="/gbi-white.png"
            alt=""
            aria-hidden
            className="h-9 sm:h-10 w-auto hidden dark:block"
          />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Index
          </h2>
        </div>
        <p className="text-muted mt-3 text-base leading-relaxed">
          GBI 100 is the flagship ranking within GBI (Global Brand
          Infrastructure), designed to identify and showcase the leading brands
          and service providers driving global expansion across markets and
          categories.
        </p>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          The GBI 100 is organized around four complementary ranking views —
          composite performance, growth momentum, traffic scale, and audience
          engagement — so users can evaluate brands from different perspectives.
        </p>
      </div>

      <RankingList companies={companies} categories={categories} />
    </div>
  );
}
