import { getAllCompanies, getCategories } from "@/lib/data";
import { RankingList } from "@/components/RankingList";

export default async function HomePage() {
  const companies = await getAllCompanies();
  const categories = await getCategories();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Banner */}
      <div className="relative rounded-xl overflow-hidden mb-6 h-28 sm:h-36">
        <img
          src="/banner.webp"
          alt="Global Brand Innovation Forum"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
        <a
          href="https://gbiworld.org"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 px-4 py-2 bg-accent text-white text-xs sm:text-sm font-semibold rounded-full border border-amber-400/60 hover:opacity-90 transition-opacity shadow-lg"
        >
          Learn More →
        </a>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          GBI 100
        </h1>
        <p className="text-muted mt-2 text-sm">
        GBI 100 is the flagship ranking within GBI (Global Brand Infrastructure), designed to identify and showcase the leading brands and service providers driving global expansion across markets and categories. · Updated{" "}
          {companies[0]?.snapshotDate
            ? new Date(companies[0].snapshotDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
              })
            : "N/A"}
        </p>
      </div>

      <RankingList companies={companies} categories={categories} />
    </div>
  );
}
