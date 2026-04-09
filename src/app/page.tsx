import { getAllCompanies, getCategories } from "@/lib/data";
import { RankingList } from "@/components/RankingList";

export default function HomePage() {
  const companies = getAllCompanies();
  const categories = getCategories();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Global Index
        </h1>
        <p className="text-muted mt-2 text-sm">
          Comprehensive ranking based on traffic, growth, and engagement · Updated{" "}
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
