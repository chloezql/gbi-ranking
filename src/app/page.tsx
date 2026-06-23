import { getAllCompanies, getCategories } from "@/lib/data";
import { RankingList } from "@/components/RankingList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const companies = await getAllCompanies();
  const categories = await getCategories();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
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
      </div>

      <RankingList companies={companies} categories={categories} />
    </div>
  );
}
