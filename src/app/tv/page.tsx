import { getAllCompanies, deriveCategories } from "@/lib/data";
import type { Company } from "@/lib/types";
import { TVRankingCarousel } from "@/components/TVRankingCarousel";

export const revalidate = 3600;

interface TVSlide {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  companies: Company[];
}

export default async function TVPage() {
  const companies = await getAllCompanies();
  const categories = deriveCategories(companies);

  const categorySlides: TVSlide[] = categories
    .filter((category) => category.slug !== "other" && category.count >= 10)
    .slice(0, 6)
    .map((category) => ({
      id: category.slug,
      title: `${category.name} Top 10`,
      eyebrow: "GBI CATEGORY RANKING",
      description: `Leading ${category.name.toLowerCase()} companies in the current GBI Index.`,
      companies: companies
        .filter((company) => company.parentCategorySlug === category.slug)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
    }))
    .filter((slide) => slide.companies.length >= 5);

  const growthCompanies = [...companies]
    .sort(
      (a, b) =>
        b.effectiveGrowthScore - a.effectiveGrowthScore ||
        b.growthRate - a.growthRate
    )
    .slice(0, 10);

  const slides: TVSlide[] = [
    {
      id: "global",
      title: "GBI Global Top 10",
      eyebrow: "GLOBAL BRAND INDEX",
      description:
        "The leading brands and service providers driving global expansion.",
      companies: companies.slice(0, 10),
    },
    ...categorySlides,
    {
      id: "growth",
      title: "Fastest Growing Top 10",
      eyebrow: "GBI GROWTH RANKING",
      description:
        "Companies combining strong traffic momentum with meaningful operating scale.",
      companies: growthCompanies,
    },
  ];

  const updatedAt = companies[0]?.snapshotDate
    ? new Date(companies[0].snapshotDate).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "Latest data";

  return <TVRankingCarousel slides={slides} updatedAt={updatedAt} />;
}
